/*
 * رحلة تعافي — Registration form
 * IMPORTANT: Only the EmailJS PUBLIC key belongs in this browser file.
 * Never paste an EmailJS Private Key or a reCAPTCHA secret key here.
 */

const CONFIG = Object.freeze({
  EMAILJS_PUBLIC_KEY: "YOUR_EMAILJS_PUBLIC_KEY",
  EMAILJS_SERVICE_ID: "YOUR_EMAILJS_SERVICE_ID",
  EMAILJS_TEMPLATE_ID: "YOUR_EMAILJS_TEMPLATE_ID",
  RECAPTCHA_V2_SITE_KEY: "YOUR_RECAPTCHA_V2_SITE_KEY",
  MIN_AGE: 18,
  MAX_AGE: 100,
  MIN_FORM_AGE_MS: 2500,
  RATE_LIMIT_MS: 10000
});

(() => {
  "use strict";

  const form = document.getElementById("registrationForm");
  const submitButton = document.getElementById("submitButton");
  const formMessage = document.getElementById("formMessage");
  const setupNotice = document.getElementById("setupNotice");
  const captchaWrap = document.getElementById("captchaWrap");
  const captchaContainer = document.getElementById("recaptchaContainer");
  const phoneInput = document.getElementById("phone");
  const ageInput = document.getElementById("age");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const honeypot = document.getElementById("website");

  if (!form || !submitButton || !formMessage) return;

  let isSubmitting = false;
  let captchaWidgetId = null;
  let captchaReady = false;
  let emailJsReady = false;
  let lastAcceptedSubmitAt = 0;
  const pageOpenedAt = Date.now();

  const emailConfigReady = () => {
    const values = [
      CONFIG.EMAILJS_PUBLIC_KEY,
      CONFIG.EMAILJS_SERVICE_ID,
      CONFIG.EMAILJS_TEMPLATE_ID
    ];
    return values.every((value) => typeof value === "string" && value.trim() !== "" && !value.startsWith("YOUR_"));
  };

  const captchaConfigReady = () => {
    return typeof CONFIG.RECAPTCHA_V2_SITE_KEY === "string" &&
      CONFIG.RECAPTCHA_V2_SITE_KEY.trim() !== "" &&
      !CONFIG.RECAPTCHA_V2_SITE_KEY.startsWith("YOUR_");
  };

  function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
    formMessage.hidden = false;
  }

  function hideMessage() {
    formMessage.hidden = true;
    formMessage.textContent = "";
    formMessage.className = "form-message";
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitButton.disabled = loading;
    submitButton.classList.toggle("is-loading", loading);
    submitButton.querySelector(".button-label").textContent = loading ? "جارٍ إرسال التسجيل..." : "إرسال التسجيل";
    submitButton.setAttribute("aria-busy", String(loading));
  }

  function normalizePhone(value) {
    return String(value || "")
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .trim()
      .replace(/[\s().-]/g, "");
  }

  function isValidPhone(value) {
    const phone = normalizePhone(value);
    const egyptianLocal = /^01[0125]\d{8}$/.test(phone);
    const egyptianInternational = /^\+?201[0125]\d{8}$/.test(phone);
    const international = /^\+[1-9]\d{7,14}$/.test(phone);
    return egyptianLocal || egyptianInternational || international;
  }

  function validatePhone() {
    if (!phoneInput) return true;
    if (!phoneInput.value.trim()) {
      phoneInput.setCustomValidity("يرجى إدخال رقم التليفون.");
      return false;
    }
    if (!isValidPhone(phoneInput.value)) {
      phoneInput.setCustomValidity("أدخل رقمًا صحيحًا؛ مثال: 01012345678 أو +201012345678.");
      return false;
    }
    phoneInput.setCustomValidity("");
    return true;
  }

  function validateAge() {
    const age = Number(ageInput.value);
    if (!ageInput.value.trim() || !Number.isInteger(age) || age < CONFIG.MIN_AGE || age > CONFIG.MAX_AGE) {
      ageInput.setCustomValidity(`يجب أن يكون السن رقمًا صحيحًا من ${CONFIG.MIN_AGE} إلى ${CONFIG.MAX_AGE} عامًا.`);
      return false;
    }
    ageInput.setCustomValidity("");
    return true;
  }

  function formatCairoDateTime() {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Cairo"
    }).format(new Date());
  }

  function loadRecaptcha() {
    if (!captchaConfigReady()) {
      captchaWrap.hidden = true;
      setupNotice.hidden = false;
      return;
    }

    captchaWrap.hidden = false;
    window.onRahletRecaptchaLoaded = () => {
      if (!window.grecaptcha || captchaWidgetId !== null) return;
      captchaWidgetId = window.grecaptcha.render(captchaContainer, {
        sitekey: CONFIG.RECAPTCHA_V2_SITE_KEY,
        callback: () => { captchaReady = true; },
        "expired-callback": () => { captchaReady = false; },
        "error-callback": () => { captchaReady = false; }
      });
    };

    const captchaScript = document.createElement("script");
    captchaScript.src = "https://www.google.com/recaptcha/api.js?onload=onRahletRecaptchaLoaded&render=explicit&hl=ar";
    captchaScript.async = true;
    captchaScript.defer = true;
    captchaScript.onerror = () => {
      captchaReady = false;
      showMessage("تعذر تحميل خدمة التحقق. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.", "error");
    };
    document.head.appendChild(captchaScript);
  }

  function initEmailJs() {
    if (!emailConfigReady() || !window.emailjs) {
      setupNotice.hidden = false;
      return;
    }

    try {
      window.emailjs.init({
        publicKey: CONFIG.EMAILJS_PUBLIC_KEY,
        blockHeadless: true,
        limitRate: {
          id: "rahlet-taafi-registration",
          throttle: CONFIG.RATE_LIMIT_MS
        }
      });
      emailJsReady = true;
    } catch (error) {
      console.error("EmailJS initialization failed.", error);
      emailJsReady = false;
    }
  }

  function friendlyEmailError(error) {
    const status = Number(error && (error.status || error.code));
    if (status === 429) return "تم إرسال طلب مؤخرًا. انتظر قليلًا ثم حاول مرة أخرى.";
    if (status === 451) return "تعذر قبول الطلب من بيئة المتصفح الحالية. افتح الموقع من متصفح عادي ثم أعد المحاولة.";
    if (status === 403) return "تم رفض الطلب بواسطة إعدادات الحماية. راجع نطاق الموقع وإعدادات EmailJS.";
    if (status === 400) return "تعذر إرسال البيانات بسبب إعدادات القالب. راجع أسماء المتغيرات في EmailJS Template.";
    return "لم نتمكن من إرسال التسجيل. تحقق من اتصال الإنترنت وحاول مرة أخرى، أو تواصل مع مسؤول الحملة.";
  }

  function resetCaptcha() {
    captchaReady = false;
    if (window.grecaptcha && captchaWidgetId !== null) {
      try { window.grecaptcha.reset(captchaWidgetId); } catch (error) { console.warn("Could not reset reCAPTCHA.", error); }
    }
  }

  function buildTemplateParams() {
    const values = new FormData(form);
    return {
      full_name: String(values.get("full_name") || "").trim(),
      phone: normalizePhone(values.get("phone")),
      gender: String(values.get("gender") || ""),
      age: String(values.get("age") || ""),
      marital_status: String(values.get("marital_status") || ""),
      address: String(values.get("address") || "").trim(),
      job: String(values.get("job") || "").trim(),
      registered_at: formatCairoDateTime(),
      consent_text: "تمت الموافقة على سياسة الخصوصية واستخدام البيانات للتواصل بشأن الحملة.",
      "g-recaptcha-response": window.grecaptcha && captchaWidgetId !== null
        ? window.grecaptcha.getResponse(captchaWidgetId)
        : ""
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    hideMessage();

    validatePhone();
    validateAge();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (honeypot && honeypot.value.trim() !== "") {
      // Do not reveal the honeypot to automated submissions.
      return;
    }

    if (Date.now() - pageOpenedAt < CONFIG.MIN_FORM_AGE_MS) {
      showMessage("يرجى مراجعة البيانات قبل الإرسال.", "error");
      return;
    }

    if (Date.now() - lastAcceptedSubmitAt < CONFIG.RATE_LIMIT_MS) {
      showMessage("انتظر عدة ثوانٍ قبل إرسال طلب آخر.", "error");
      return;
    }

    if (!emailConfigReady() || !emailJsReady || !window.emailjs) {
      showMessage("لم يتم تفعيل خدمة الإرسال بعد. راجع إعدادات EmailJS في ملف script.js ودليل README.md.", "error");
      return;
    }

    if (!captchaConfigReady() || captchaWidgetId === null || !window.grecaptcha) {
      showMessage("لم يتم تفعيل reCAPTCHA v2 بعد. لا يمكن إرسال التسجيل قبل تفعيل الحماية من الرسائل الآلية.", "error");
      return;
    }

    const captchaToken = window.grecaptcha.getResponse(captchaWidgetId);
    if (!captchaToken || !captchaReady) {
      showMessage("يرجى إكمال اختبار التحقق قبل إرسال التسجيل.", "error");
      return;
    }

    setLoading(true);
    lastAcceptedSubmitAt = Date.now();

    try {
      const templateParams = buildTemplateParams();
      await window.emailjs.send(
        CONFIG.EMAILJS_SERVICE_ID,
        CONFIG.EMAILJS_TEMPLATE_ID,
        templateParams
      );

      form.reset();
      resetCaptcha();
      showMessage("تم استلام بيانات تسجيلك بنجاح. شكراً لثقتك، ونتمنى لك بداية جديدة مليئة بالأمل.", "success");
    } catch (error) {
      console.error("Registration email could not be sent.", error);
      resetCaptcha();
      showMessage(friendlyEmailError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  phoneInput.addEventListener("input", () => {
    phoneInput.setCustomValidity("");
    hideMessage();
  });
  phoneInput.addEventListener("blur", validatePhone);
  ageInput.addEventListener("input", () => {
    ageInput.setCustomValidity("");
    hideMessage();
  });
  ageInput.addEventListener("blur", validateAge);
  form.addEventListener("submit", handleSubmit);

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "فتح القائمة" : "إغلاق القائمة");
      mainNav.classList.toggle("is-open", !isOpen);
    });
    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "فتح القائمة");
        mainNav.classList.remove("is-open");
      });
    });
  }

  const year = document.getElementById("currentYear");
  if (year) year.textContent = String(new Date().getFullYear());

  initEmailJs();
  loadRecaptcha();
})();
