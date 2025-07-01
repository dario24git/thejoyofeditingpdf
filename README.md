# The joy of editing PDF

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/edit/sb1-bacspsct?file=README.md)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

This project was made to make my life easier, i hope one day to give it back to the internet for free!!!

I made this with bolt.new for the great hackaton which had place in june 2025 (i started the last 2 days because bolt was free for the weekend :'] ).

# What it does

This webapp allows you to take the text outside of a pdf using Google AI OCR processor, then the text get layered on a web editor, which allows you to edit the extracted and mapped text. You can also add editable forms/checkbox.

# Can I use it?

Well, yes, but you have to selfhost it for now. Also you need to use the following data in your .env

### Supabase
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_URL
### Google Cloud Configuration for Document AI
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_LOCATION
GOOGLE_DOCUMENT_AI_PROCESSOR_ID
GOOGLE_CLOUD_API_KEY
GOOGLE_SERVICE_ACCOUNT_JSON
