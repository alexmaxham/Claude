/* Alt text drafts for the AH Image Resizer, made from the topic or the file name. */
(function () {
  'use strict';

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

  window.AHAlt = { fromName: fromName, humanise: humanise };
})();
