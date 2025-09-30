//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit');
const router = govukPrototypeKit.requests.setupRouter();

// Deps used by routes below
const fs = require('fs');
const path = require('path');
const express = require('express');
const nunjucks = require('nunjucks');

// Body parser for raw Nunjucks source used by the preview route
const textParser = express.text({ type: '*/*', limit: '1mb' });

// Find an address plugin
const findAddressPlugin = require('find-an-address-plugin');
findAddressPlugin(router);

// Logging session data
router.use((req, res, next) => {
  const log = {
    method: req.method,
    url: req.originalUrl,
    data: req.session.data
  };
  console.log(JSON.stringify(log, null, 2));
  next();
});

// Show current and previous URL
router.use('/', (req, res, next) => {
  res.locals.currentURL = req.originalUrl;
  res.locals.prevURL = req.get('Referrer');
  console.log('folder : ' + res.locals.folder + ', subfolder : ' + res.locals.subfolder);
  next();
});

// Example journey routing
router.post('/country-answer', (req, res) => {
  const country = req.session.data['country'];
  if (country === 'England') {
    res.redirect('example/complete');
  } else {
    res.redirect('example/ineligible');
  }
});

// -------------------------------
// Templates: serve NJK as text
// -------------------------------
router.get('/templates/:name', (req, res) => {
  const allowed = new Set([
    'start',
    'blank',
    'question',
    'confirmation',
    'cya',
    'guidance',
    'step-by-step'
  ]);

  const name = String(req.params.name || '').toLowerCase();
  if (!allowed.has(name)) return res.status(404).type('text/plain').send('Template not found');

  const filePath = path.join(__dirname, 'views', 'templates', `${name}.njk`);
  fs.readFile(filePath, 'utf8', (err, text) => {
    if (err) return res.status(404).type('text/plain').send('Template not found');
    res.type('text/plain').send(text);
  });
});

// ----------------------------------------------
// Components: return Nunjucks macro call strings
// ----------------------------------------------
router.get('/components-macro/:name', (req, res) => {
  const name = String(req.params.name || '').toLowerCase();

  const builders = {
    'button-basic': q => {
      const text = q.text || 'Continue';
      const href = q.href || undefined;
      const isStartButton = q.isStartButton === 'true' ? true : undefined;
      const opts = {
        text,
        ...(href ? { href } : {}),
        ...(isStartButton ? { isStartButton: true } : {})
      };
      return `{{ govukButton(${stringify(opts)}) }}`;
    },

    'input-text': q => {
      const id = q.id || 'full-name';
      const nameAttr = q.name || 'full-name';
      const label = q.label || 'Full name';
      const hint = q.hint || 'As shown on your passport';
      const autocomplete = q.autocomplete || 'name';
      const opts = {
        id,
        name: nameAttr,
        label: { text: label },
        hint: { text: hint },
        autocomplete
      };
      return `{{ govukInput(${stringify(opts)}) }}`;
    },

    'radios': q => {
      const idPrefix = q.idPrefix || 'choices';
      const nameAttr = q.name || 'choices';
      const legend = q.legend || 'Choose one option';

      // Accept items JSON via query, e.g. ?items=[{"value":"yes","text":"Yes"},...]
      let items;
      if (q.items) {
        try {
          items = JSON.parse(q.items);
          if (!Array.isArray(items) || !items.length) throw new Error('bad items');
        } catch {
          items = null;
        }
      }

      if (!items) {
        const yn = q.yn === 'true';
        items = yn
          ? [{ value: 'yes', text: 'Yes' }, { value: 'no', text: 'No' }]
          : [
              { value: 'option-1', text: 'Option 1' },
              { value: 'option-2', text: 'Option 2' }
            ];
      }

      const opts = {
        idPrefix,
        name: nameAttr,
        fieldset: { legend: { text: legend, isPageHeading: false, classes: 'govuk-fieldset__legend--m' } },
        items
      };
      return `{{ govukRadios(${stringify(opts)}) }}`;
    },

    'checkboxes': q => {
      const idPrefix = q.idPrefix || 'support-needs';
      const nameAttr = q.name || 'support-needs';
      const legend = q.legend || 'Do you need any support?';
      const hint = q.hint || 'Select all that apply';
      const opts = {
        idPrefix,
        name: nameAttr,
        fieldset: { legend: { text: legend, isPageHeading: false, classes: 'govuk-fieldset__legend--m' } },
        hint: { text: hint },
        items: [
          { value: 'wheelchair-access', text: 'Wheelchair access' },
          { value: 'hearing-loop', text: 'Hearing loop' },
          { value: 'interpreter', text: 'Interpreter' }
        ]
      };
      return `{{ govukCheckboxes(${stringify(opts)}) }}`;
    },

    'date-input': q => {
      const id = q.id || 'date-of-birth';
      const namePrefix = q.namePrefix || 'dob';
      const legend = q.legend || 'What is your date of birth?';
      const hint = q.hint || 'For example, 27 3 2007';
      const opts = {
        id,
        namePrefix,
        fieldset: { legend: { text: legend, classes: 'govuk-fieldset__legend--m' } },
        hint: { text: hint }
      };
      return `{{ govukDateInput(${stringify(opts)}) }}`;
    },

    'error-summary': q => {
      const titleText = q.title || 'There is a problem';
      const href = q.href || '#full-name';
      const text = q.text || 'Enter your full name';
      const opts = {
        titleText,
        errorList: [{ text, href }]
      };
      return `{{ govukErrorSummary(${stringify(opts)}) }}`;
    },

    'notification-banner': q => {
      const titleText = q.title || 'Important';
      const text = q.text || 'Your session will time out after 15 minutes of inactivity.';
      const opts = { titleText, text };
      return `{{ govukNotificationBanner(${stringify(opts)}) }}`;
    },

    'panel': q => {
      const titleText = q.title || 'Application complete';
      const ref = q.ref || 'HDJ2123F';
      const opts = { titleText, html: `Your reference number<br><strong>${escapeHtml(ref)}</strong>` };
      return `{{ govukPanel(${stringify(opts)}) }}`;
    },

    'summary-list': q => {
      const opts = {
        rows: [
          { key: { text: 'Name' }, value: { text: 'Alex Smith' }, actions: { items: [{ href: '#', text: 'Change', visuallyHiddenText: 'name' }] } },
          { key: { text: 'Date of birth' }, value: { text: '27 March 2007' }, actions: { items: [{ href: '#', text: 'Change', visuallyHiddenText: 'date of birth' }] } }
        ]
      };
      return `{{ govukSummaryList(${stringify(opts)}) }}`;
    },
    // DETAILS
'details': q => {
  const summaryText = q.summaryText || 'Help with nationality';
  const text = q.text || 'We need to know your nationality so we can work out which elections you’re entitled to vote in. If you cannot provide your nationality, you’ll have to send copies of identity documents through the post.';
  const opts = { summaryText, text };
  return `{{ govukDetails(${stringify(opts)}) }}`;
},

// COOKIE BANNER
'cookie-banner': q => {
  const ariaLabel = q.ariaLabel || 'Cookies on [name of service]';
  // Allow custom HTML via q.html, otherwise use a sane default
  const html = q.html || (
    '<p class="govuk-body">We use some essential cookies to make this service work.</p>' +
    '<p class="govuk-body">We’d also like to use analytics cookies so we can understand how you use the service and make improvements.</p>'
  );
  const opts = {
    ariaLabel,
    messages: [
      {
        headingText: ariaLabel,
        html,
        actions: [
          { text: 'Accept analytics cookies', type: 'button' },
          { text: 'Reject analytics cookies',  type: 'button' },
          { text: 'View cookies', href: '#' }
        ]
      }
    ]
  };
  return `{{ govukCookieBanner(${stringify(opts)}) }}`;
},

// BREADCRUMBS
'breadcrumbs': q => {
  // Accept items as JSON, else a sensible default
  let items = null;
  if (q.items) {
    try {
      const parsed = JSON.parse(q.items);
      if (Array.isArray(parsed) && parsed.length) items = parsed;
    } catch {/* ignore */}
  }
  if (!items) {
    items = [
      { text: 'Home', href: '#' },
      { text: 'Passports, travel and living abroad', href: '#' },
      { text: 'Travel abroad', href: '#' }
    ];
  }
  const opts = { items };
  return `{{ govukBreadcrumbs(${stringify(opts)}) }}`;
},

// WARNING TEXT
'warning-text': q => {
  const text = q.text || 'You can be fined up to £5,000 if you do not register.';
  const iconFallbackText = q.iconFallbackText || 'Warning';
  const opts = { text, iconFallbackText };
  return `{{ govukWarningText(${stringify(opts)}) }}`;
},

// TEXTAREA
'textarea': q => {
  const id = q.id || 'more-detail';
  const name = q.name || 'moreDetail';
  const labelText = q.label || 'Can you provide more detail?';
  const hint = q.hint || 'Do not include personal or financial information, like your National Insurance number or credit card details';
  const opts = {
    id, name,
    label: { text: labelText, classes: 'govuk-label--l', isPageHeading: false },
    hint: { text: hint }
  };
  return `{{ govukTextarea(${stringify(opts)}) }}`;
},

// TAG
'tag': q => {
  const text = q.text || 'Completed';
  const classes = q.classes || ''; // e.g. 'govuk-tag--green'
  const opts = { text, ...(classes ? { classes } : {}) };
  return `{{ govukTag(${stringify(opts)}) }}`;
},

// TABS (with tables in panels, returns multi-line NJK)
'tabs': q => {
  // Optional: headings via ?labels=Past%20day|Past%20week|Past%20month|Past%20year
  const labels = (q.labels || 'Past day|Past week|Past month|Past year').split('|').map(s => s.trim()).filter(Boolean);
  const ids = labels.map(l => l.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  // Build 4 {% set %} blocks with placeholder tables, then govukTabs
  let blocks = '';
  labels.forEach((label, idx) => {
    blocks += `{% set panel${idx} %}\n<h2 class="govuk-heading-l">${label}</h2>\n` +
`{{ govukTable({
  head: [{ text: "Case manager" }, { text: "Cases opened" }, { text: "Cases closed" }],
  rows: [
    [ { text: "David Francis" }, { text: "${idx+1}" }, { text: "0" } ],
    [ { text: "Paul Farmer" }, { text: "${idx+2}" }, { text: "0" } ],
    [ { text: "Rita Patel" }, { text: "${idx+3}" }, { text: "0" } ]
  ]
}) }}\n{% endset %}\n\n`;
  });
  const items = labels.map((label, idx) => ({ label, id: ids[idx], panel: { var: `panel${idx}` } }));
  const itemsLiteral = items.map(it => (
`{
  label: "${it.label}",
  id: "${it.id}",
  panel: { html: ${it.panel.var} }
}`)).join(',\n    ');
  return `${blocks}{{ govukTabs({ items: [\n    ${itemsLiteral}\n] }) }}`;
},

// TABLE
'table': q => {
  const caption = q.caption || 'Dates and amounts';
  const opts = {
    caption,
    captionClasses: 'govuk-table__caption--m',
    firstCellIsHeader: true,
    head: [{ text: 'Date' }, { text: 'Amount' }],
    rows: [
      [{ text: 'First 6 weeks' }, { text: '£109.80 per week' }],
      [{ text: 'Next 33 weeks' }, { text: '£109.80 per week' }],
      [{ text: 'Total estimated pay' }, { text: '£4,282.20' }]
    ]
  };
  return `{{ govukTable(${stringify(opts)}) }}`;
},

// SERVICE NAVIGATION
'service-navigation': q => {
  const nav = q.navigation ? safeParseArray(q.navigation) : [
    { href: '#', text: 'Navigation item 1' },
    { href: '#', text: 'Navigation item 2', active: true },
    { href: '#', text: 'Navigation item 3' }
  ];
  const opts = { navigation: nav };
  return `{{ govukServiceNavigation(${stringify(opts)}) }}`;
},

// PASSWORD INPUT
'password-input': q => {
  const id = q.id || 'password-input';
  const name = q.name || 'password';
  const label = q.label || 'Password';
  const opts = { id, name, label: { text: label } };
  return `{{ govukPasswordInput(${stringify(opts)}) }}`;
},

// PAGINATION
'pagination': q => {
  const items = q.items ? safeParseArray(q.items) : [
    { number: 1, href: '#' },
    { number: 2, current: true, href: '#' },
    { number: 3, href: '#' }
  ];
  const opts = { previous: { href: '#' }, next: { href: '#' }, items };
  return `{{ govukPagination(${stringify(opts)}) }}`;
},

// INSET TEXT
'inset-text': q => {
  const text = q.text || 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.';
  return `{{ govukInsetText(${stringify({ text })}) }}`;
},

// FILE UPLOAD
'file-upload': q => {
  const id = q.id || 'file-upload-1';
  const name = q.name || 'fileUpload1';
  const label = q.label || 'Upload a file';
  const opts = { id, name, label: { text: label } };
  return `{{ govukFileUpload(${stringify(opts)}) }}`;
},

// FIELDSET (returns a NJK call block with inputs inside)
'fieldset': q => {
  const legend = q.legend || 'What is your address?';
  return `{% call govukFieldset({ legend: { text: "${legend}", classes: "govuk-fieldset__legend--l", isPageHeading: true } }) %}

  {{ govukInput({ label: { text: "Address line 1" }, id: "address-line-1", name: "addressLine1", autocomplete: "address-line1" }) }}
  {{ govukInput({ label: { text: "Address line 2 (optional)" }, id: "address-line-2", name: "addressLine2", autocomplete: "address-line2" }) }}
  {{ govukInput({ label: { text: "Town or city" }, classes: "govuk-!-width-two-thirds", id: "address-town", name: "addressTown", autocomplete: "address-level2" }) }}
  {{ govukInput({ label: { text: "Postcode" }, classes: "govuk-input--width-10", id: "address-postcode", name: "addressPostcode", autocomplete: "postal-code" }) }}

{% endcall %}`;
},

// EXIT THIS PAGE
'exit-this-page': q => {
  return `{{ govukExitThisPage() }}`;
},

// DATE INPUT WITH ERROR (specialised variant)
'date-input-error': q => {
  const legend = q.legend || 'When was your passport issued?';
  const hint = q.hint || 'For example, 27 3 2007';
  const errorText = q.errorText || 'The date your passport was issued must be in the past';
  const opts = {
    fieldset: { legend: { text: legend, isPageHeading: true, classes: 'govuk-fieldset__legend--l' } },
    hint: { text: hint },
    errorMessage: { text: errorText },
    id: 'passport-issued',
    namePrefix: 'passport-issued',
    items: [
      { classes: 'govuk-input--width-2 govuk-input--error', name: 'day', value: '6' },
      { classes: 'govuk-input--width-2 govuk-input--error', name: 'month', value: '3' },
      { classes: 'govuk-input--width-4 govuk-input--error', name: 'year', value: '2076' }
    ]
  };
  return `{{ govukDateInput(${stringify(opts)}) }}`;
},

// ACCORDION
'accordion': q => {
  const id = q.id || 'accordion-default';

  // Accept items as JSON. Each item: { heading: { text }, content: { html } }
  let items = null;
  if (q.items) {
    try {
      const parsed = JSON.parse(q.items);
      if (Array.isArray(parsed) && parsed.length) items = parsed;
    } catch {/* ignore */}
  }
  if (!items) {
    items = [
      { heading: { text: 'Writing well for the web' },        content: { html: '<p class="govuk-body">This is the content for Writing well for the web.</p>' } },
      { heading: { text: 'Writing well for specialists' },     content: { html: '<p class="govuk-body">This is the content for Writing well for specialists.</p>' } },
      { heading: { text: 'Know your audience' },               content: { html: '<p class="govuk-body">This is the content for Know your audience.</p>' } },
      { heading: { text: 'How people read' },                  content: { html: '<p class="govuk-body">This is the content for How people read.</p>' } }
    ];
  }

  const opts = { id, items };
  return `{{ govukAccordion(${stringify(opts)}) }}`;
}
  };

  const build = builders[name];
  if (!build) return res.status(404).type('text/plain').send('Component not supported');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }
  function stringify(obj) {
    return JSON.stringify(obj, null, 2)
      .replace(/"([^"]+)":/g, '$1:'); // unquote keys only
  }
  
  function safeParseArray(json) {
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : null;
    } catch { return null; }
  }
  

  const fragment = build(req.query || {});
  res.type('text/plain').send(fragment);
});

// ---------------------------------------
// Exact preview: render NJK to real HTML
// ---------------------------------------

router.post('/preview-render', textParser, (req, res) => {
  try {
    const njk = String(req.body || '');

    // Reuse the kit's Nunjucks env if available
    const env =
      req.app.locals?.nunjucksEnv ||
      req.app.get('nunjucksEnv') ||
      nunjucks.configure(
        [
          path.join(__dirname, 'views'),
          path.join(__dirname, '../node_modules/govuk-frontend')
        ],
        { express: req.app, autoescape: true }
      );

    let html = env.renderString(njk, {
      serviceName: 'Your service'
    });

    // Inject a <base> so relative asset URLs resolve inside <iframe srcdoc>
    const baseHref = `${req.protocol}://${req.get('host')}/`;
    const baseTag = `<base href="${baseHref}">`;

    // Only add if not present already
    if (!/<!\s*base\b/i.test(html)) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
      } else {
        // No <head> in the rendered fragment, prepend one
        html = `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
      }
    }

    res.type('html').send(html);
  } catch (err) {
    res.status(400).type('text/plain').send(
      `Preview render error: ${err.message}`
    );
  }
});


module.exports = router;
