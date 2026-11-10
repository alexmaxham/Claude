/* Settings for "write alt text from the picture". Both values are public; the Anthropic key is NOT here (it lives on the server).
   Leave either one empty and the page simply hides the Claude option. See server/README.md for where these come from. */
window.AH_CONFIG = {
  // Web address of the alt text server, for example "https://ah-alt-text.your-name.workers.dev"
  altServer: '',
  // Google sign-in client ID, ending in ".apps.googleusercontent.com"
  googleClientId: ''
};
