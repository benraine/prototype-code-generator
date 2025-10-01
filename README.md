

# GOV.UK Prototype Kit - Offline Page Generator

This tool generates **Nunjucks templates** for the [GOV.UK Prototype Kit](https://prototype-kit.service.gov.uk/), letting you describe a page in plain English and preview it live. It supports common page types (Start, Question, Confirmation, etc.) and GOV.UK Design System components.

It works offline and provides an exact live preview using the same Nunjucks environment as the Prototype Kit.



## Features

* Generate Nunjucks pages by writing a prompt (e.g. "question page with radios for yes/no and continue button below").
* Live preview of the rendered page.
* Copy generated Nunjucks code directly into your Prototype Kit.
* Supports key GOV.UK page templates:

  * Start page
  * Blank page
  * Question page
  * Confirmation page
  * Check your answers
  * Guidance page
  * Step by step page
    
* Supports GOV.UK Design System components, including:

  * Radios, checkboxes, text inputs, textareas, date inputs
  * Buttons, panels, error summary, notification banners
  * Details, cookie banner, breadcrumbs, accordion
  * Warning text, tags, tabs, table, service navigation
  * Password input, pagination, inset text, file upload, fieldset
  * Exit this page, date input with error
    
* Components are inserted with sensible defaults and positioning rules:

  * **Cookie banner** is always at the top of the page
  * **Exit this page** is always below the header (and cookie banner, if present)
  * **Panel** replaces the page `<h1>` heading
  * **Breadcrumbs** are always above the main content
  * **Service navigation** is always included (prompted or default) and aligned with the header

---

## Installation

### 1. Clone this repository

```sh
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Install dependencies

```sh
npm install
```

Make sure `govuk-frontend` is installed (it is listed in `package.json`).

### 3. Run locally

```sh
npm run dev
```

Visit http://localhost:3000 

---

## Usage

On the index page, click the Get Started button.

1. In the **Prompt** box, describe the page you want:

   Example:

   ```
   Question page with yes/no radios and a continue button below
   ```

2. Click **Generate**.

   * The **Live preview** shows exactly how the page will look.
   * The **Generated Nunjucks code** box shows the template to copy.

3. Click **Copy code** to copy the output.

4. Paste into your Prototype Kit into a HTML file 



## How it works

* **Templates** (`/templates`)

  * Base templates (start, question, blank, etc.) are stored as `.njk` files in `app/views/templates`.
  * The tool chooses the right base template based on keywords in your prompt.

* **Component macros** (`/components-macro`)

  * Each GOV.UK component has a small "builder" that returns a macro call like:

    ```nunjucks
    {{ govukRadios({ ... }) }}
    ```
  * The tool detects components from your prompt and inserts them in order.

* **Positioning rules**

  * Special rules ensure certain components always appear in fixed positions (cookie banner, exit this page, panel, breadcrumbs, service navigation).
  * Other components are placed in the main content area in the order they’re mentioned.

* **Preview render**

  * The generator sends the built Nunjucks string to `/preview-render`, which uses the Prototype Kit’s Nunjucks environment (with `govuk-frontend`) to render exact HTML.
  * This means the preview matches what you’ll see in your real prototype.



## Notes

* `govukRebrand` is set globally in the Nunjucks environment to `true`.
* The GOV.UK header is always rendered **without service name**, and with the class `govuk-header--full-width-border`.
* Service navigation defaults to:

  ```nunjucks
  {% from "govuk/components/service-navigation/macro.njk" import govukServiceNavigation %}

  {{ govukServiceNavigation({
    serviceName: "Service name",
    serviceUrl: "#",
    navigation: [
      { href: "#", text: "Navigation item 1" },
      { href: "#", text: "Navigation item 2", active: true },
      { href: "#", text: "Navigation item 3" }
    ]
  }) }}
  ```

---


