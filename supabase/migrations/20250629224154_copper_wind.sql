/*
  # Subscription and Usage Tracking System

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `stripe_customer_id` (text)
      - `stripe_subscription_id` (text)
      - `plan_type` (enum: free, creative_artist, pdf_master)
      - `status` (enum: active, canceled, past_due, incomplete)
      - `current_period_start` (timestamp)
      - `current_period_end` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `usage_tracking`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `month_year` (text) - format: "2025-01"
      - `pdf_uploads` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to access their own data

  3. Functions
    - Function to check usage limits
    - Function to increment usage
    - Function to get current subscription
*/

-- Create enums
CREATE TYPE plan_type AS ENUM ('free', 'creative_artist', 'pdf_master');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'incomplete', 'trialing');

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type plan_type NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_year text NOT NULL, -- Format: "2025-01"
  pdf_uploads integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Users can read own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for usage tracking
CREATE POLICY "Users can read own usage"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month_year ON usage_tracking(month_year);

-- Function to get current subscription
CREATE OR REPLACE FUNCTION get_user_subscription(user_uuid uuid)
RETURNS TABLE (
  plan_type plan_type,
  status subscription_status,
  current_period_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.plan_type, s.status, s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = user_uuid
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month usage
CREATE OR REPLACE FUNCTION get_current_usage(user_uuid uuid)
RETURNS TABLE (
  pdf_uploads integer,
  month_year text
) AS $$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  RETURN QUERY
  SELECT ut.pdf_uploads, ut.month_year
  FROM usage_tracking ut
  WHERE ut.user_id = user_uuid AND ut.month_year = current_month;
  
  -- If no record exists, return 0
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::integer, current_month;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can upload (within limits)
CREATE OR REPLACE FUNCTION can_user_upload(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  user_plan plan_type;
  user_status subscription_status;
  current_uploads integer;
  upload_limit integer;
  current_month text;
BEGIN
  -- Get user's subscription
  SELECT plan_type, status INTO user_plan, user_status
  FROM subscriptions
  WHERE user_id = user_uuid
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Default to free plan if no subscription found
  IF user_plan IS NULL THEN
    user_plan := 'free';
    user_status := 'active';
  END IF;
  
  -- Check if subscription is active
  IF user_status != 'active' AND user_status != 'trialing' THEN
    RETURN false;
  END IF;
  
  -- Set upload limits based on plan
  CASE user_plan
    WHEN 'free' THEN upload_limit := 3;
    WHEN 'creative_artist' THEN upload_limit := 10;
    WHEN 'pdf_master' THEN upload_limit := 30;
    ELSE upload_limit := 3;
  END CASE;
  
  -- Get current month usage
  current_month := to_char(now(), 'YYYY-MM');
  
  SELECT COALESCE(pdf_uploads, 0) INTO current_uploads
  FROM usage_tracking
  WHERE user_id = user_uuid AND month_year = current_month;
  
  -- If no usage record, assume 0
  IF current_uploads IS NULL THEN
    current_uploads := 0;
  END IF;
  
  -- Check if within limits
  RETURN current_uploads < upload_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Insert or update usage record
  INSERT INTO usage_tracking (user_id, month_year, pdf_uploads)
  VALUES (user_uuid, current_month, 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET 
    pdf_uploads = usage_tracking.pdf_uploads + 1,
    updated_at = now();
    
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_type, status)
  VALUES (new.id, 'free', 'active');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to also create subscription
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user record
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  
  -- Create default subscription
  INSERT INTO subscriptions (user_id, plan_type, status)
  VALUES (new.id, 'free', 'active');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();