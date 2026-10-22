window.isLandingPage =
    document.referrer.split('/')[2] !== location.host ? true : false;
  window.analyticsQueue = window.analyticsQueue || [];
  window.analyticsIncognitoQueue = window.analyticsIncognitoQueue || [];
  window.sendEvent = function (evt) {
    if (window.ikea?.cookieConsent?.hasConsent(2)){
      window.analyticsQueue.push(evt);
    }
    window.analyticsIncognitoQueue.push(evt);
    const event = new CustomEvent('incognitoEvent', { detail: { ...evt } });
    window.dispatchEvent(event);
  };
  window.ikea.analytics = {};
  window.ikea.analytics.observeProducts = [];
  window.ikea.analytics.observeProductDetails = [];
  window.ikea.analytics.persisted = {};
  window.ikea.analytics.persist = function (dimensions) {
    Object.assign(window.ikea.analytics.persisted, dimensions);
  };

  window.ikea.analytics.clientInfo = {
    isLandingPage: window.isLandingPage,
    hasConsent: window.ikea?.cookieConsent?.hasConsent(2) || false,
    userAgent: navigator.userAgent,
    userLanguage: navigator.language,
    referrer: document.referrer,
    platform: navigator.platform,
  }