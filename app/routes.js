//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Find an address plugin
const findAddressPlugin = require("find-an-address-plugin");

findAddressPlugin(router);

// Logging session data  
// This code shows in the terminal what session data has been saved.
router.use((req, res, next) => {    
    const log = {  
      method: req.method,  
      url: req.originalUrl,  
      data: req.session.data  
    }  
    console.log(JSON.stringify(log, null, 2))  
   
  next()  
})  

// This code shows in the terminal what page you are on and what the previous page was.
router.use('/', (req, res, next) => {  
    res.locals.currentURL = req.originalUrl; //current screen  
    res.locals.prevURL = req.get('Referrer'); // previous screen
  
  console.log('folder : ' + res.locals.folder + ', subfolder : ' + res.locals.subfolder  );
  
    next();  
  });

  // Routing for the example journey. 
  router.post('/country-answer', function(request, response) {

    var country = request.session.data['country']
    if (country == "England"){
        response.redirect("example/complete")
    } else {
        response.redirect("example/ineligible")
    }
})


  // Add your routes here
  const fs = require('fs');
const path = require('path');
// Serve Nunjucks templates as plain text for the generator UI
router.get('/templates/:name', (req, res) => {
  // Whitelist allowed template names to avoid path traversal
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


// Return Nunjucks fragments that call govuk-frontend macros.
// Example: GET /components-macro/button-basic           -> returns {{ govukButton({ text: "Continue" }) }}
//          GET /components-macro/input-text?label=Name  -> returns {{ govukInput({ ... label: { text: "Name" } }) }}

router.get('/components-macro/:name', (req, res) => {
  const name = String(req.params.name || '').toLowerCase();

  // Define supported components and how to produce their Nunjucks call
  const builders = {
    'button-basic': (q) => {
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

    'input-text': (q) => {
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

    // in app/routes.js (inside the existing /components-macro route)

'radios': (q) => {
  const idPrefix = q.idPrefix || 'choices';
  const nameAttr = q.name || 'choices';
  const legend = q.legend || 'Choose one option';

  // Accept items as JSON in the querystring, e.g. ?items=[{"value":"yes","text":"Yes"},...]
  let items;
  if (q.items) {
    try {
      items = JSON.parse(q.items);
      if (!Array.isArray(items) || !items.length) throw new Error('bad items');
    } catch {
      items = null; // fall back to defaults
    }
  }

  if (!items) {
    // detect yes/no request
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

    'checkboxes': (q) => {
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

    'date-input': (q) => {
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

    'error-summary': (q) => {
      const titleText = q.title || 'There is a problem';
      const href = q.href || '#full-name';
      const text = q.text || 'Enter your full name';
      const opts = {
        titleText,
        errorList: [{ text, href }]
      };
      return `{{ govukErrorSummary(${stringify(opts)}) }}`;
    },

    'notification-banner': (q) => {
      const titleText = q.title || 'Important';
      const text = q.text || 'Your session will time out after 15 minutes of inactivity.';
      const opts = { titleText, text };
      return `{{ govukNotificationBanner(${stringify(opts)}) }}`;
    },

    'panel': (q) => {
      const titleText = q.title || 'Application complete';
      const ref = q.ref || 'HDJ2123F';
      const opts = { titleText, html: `Your reference number<br><strong>${escapeHtml(ref)}</strong>` };
      return `{{ govukPanel(${stringify(opts)}) }}`;
    },

    'summary-list': (q) => {
      const opts = {
        rows: [
          { key: { text: 'Name' }, value: { text: 'Alex Smith' }, actions: { items: [{ href: '#', text: 'Change', visuallyHiddenText: 'name' }] } },
          { key: { text: 'Date of birth' }, value: { text: '27 March 2007' }, actions: { items: [{ href: '#', text: 'Change', visuallyHiddenText: 'date of birth' }] } }
        ]
      };
      return `{{ govukSummaryList(${stringify(opts)}) }}`;
    }
  };

  const build = builders[name];
  if (!build) return res.status(404).type('text/plain').send('Component not supported');

  // Utilities local to this route
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function stringify(obj) {
    // Produce JSON-like literal suitable for Nunjucks macro arguments
    return JSON.stringify(obj, null, 2)
      .replace(/"([^"]+)":/g, '$1:')       // unquote keys
      .replace(/"([^"]*)"/g, '"$1"');      // keep string quotes
  }

  const fragment = build(req.query || {});
  res.type('text/plain').send(fragment);
});
