/* Alt text for the AH Image Resizer: a quick draft from the file name, or a description of the picture written by Claude. */
(function () {
  'use strict';

  var MODEL = 'claude-opus-5-5';
  var MAX_SIDE = 1024; // the copy sent to Claude is shrunk to this; plenty for a one-line description
  var SYSTEM = [
    'You write alt text for images published by AndroidHeadlines, a technology news site.',
    'Alt text is read aloud by screen readers to people who cannot see the image.',
    'Write one plain sentence, at most 125 characters, that says what is actually visible in the image.',
    'The file name and topic the editor gives you are hints about which product or story this is: use them to name the product when the image is consistent with them, and ignore them when they are generic (camera names like IMG_4821) or clearly do not match the picture.',
    'Do not start with "Image of" or "Picture of". Do not mention watermarks or logos added by the publisher. Do not guess at things you cannot see, and do not name real people.',
    'Reply with the alt text only: no quotes, no label, no explanation.'
  ].join(' ');

  var sdkLoading = null;
  function loadSdk() {
    if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK);
    if (!sdkLoading) {
      sdkLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'vendor/anthropic-sdk.js';
        script.onload = function () { resolve(window.AnthropicSDK); };
        script.onerror = function () { sdkLoading = null; reject(new Error('Could not load the Claude library.')); };
        document.head.appendChild(script);
      });
    }
    return sdkLoading;
  }

  function humanise(text) {
    var words = String(text).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
  }

  /** A draft made only from words: the topic if there is one, otherwise a file name that reads like words. */
  function fromName(fileName, topic) {
    if (topic && topic.trim()) return humanise(topic);
    var base = String(fileName).replace(/\.[a-z0-9]{2,5}$/i, '');
    // Camera and screenshot names (IMG_4821, PXL_2026..., Screenshot 2026-11-09) say nothing about the picture.
    if (/^(img|dsc|dscn|dscf|pxl|mvimg|gopr|photo|image|screenshot|screen shot|untitled|wp)?[\s_\-.]*[\d\s_\-.()]*$/i.test(base)) return '';
    return humanise(base);
  }

  function tidy(text) {
    return String(text).replace(/\s+/g, ' ').trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/^alt text:\s*/i, '');
  }

  /**
   * Asks Claude to describe one image. jpegBase64 is the picture as it will be published (no watermark), shrunk.
   * Throws an Error with a plain-English message when it can't.
   */
  async function describe(opts) {
    var Anthropic = await loadSdk();
    // The key is typed in by the person using the page and sent straight from their browser to Anthropic.
    var client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });
    var hint = 'Original file name: ' + opts.fileName + '\n' + (opts.topic ? 'Topic: ' + opts.topic + '\n' : '') + 'Write the alt text for this image.';
    var response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: opts.jpegBase64 } },
            { type: 'text', text: hint }
          ]
        }]
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new Error('That API key was not accepted. Check it and try again.');
      if (err instanceof Anthropic.PermissionDeniedError) throw new Error('That API key is not allowed to do this.');
      if (err instanceof Anthropic.RateLimitError) throw new Error('Claude is busy or the key has hit its limit. Wait a minute and try again.');
      if (err instanceof Anthropic.APIConnectionError) throw new Error('Could not reach Claude. Check the internet connection.');
      if (err instanceof Anthropic.APIError) throw new Error('Claude returned an error (' + (err.status || 'unknown') + ').');
      throw err;
    }
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to describe this image.');
    var text = response.content.filter(function (block) { return block.type === 'text'; }).map(function (block) { return block.text; }).join(' ');
    text = tidy(text);
    if (!text) throw new Error('Claude sent back no text for this image.');
    return text;
  }

  window.AHAlt = { MODEL: MODEL, MAX_SIDE: MAX_SIDE, fromName: fromName, describe: describe, humanise: humanise };
})();
