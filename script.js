/**
 * script.js — Silly Stitches
 * ─────────────────────────────────────────────────────────────
 * Minimal vanilla JS for:
 *   1. Mobile navigation toggle
 *   2. Scroll-triggered "reveal" animations
 *   3. Order form: validation, submission, and feedback
 *   4. Order page: pre-fill product from URL query param
 *   5. Shop page: filter button active state (visual only)
 * ─────────────────────────────────────────────────────────────
 */

/* ============================================================
   1. MOBILE NAVIGATION TOGGLE
   ============================================================ */
(function initNav() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');

  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));

    // Animate hamburger bars into an X
    const bars = toggle.querySelectorAll('span');
    if (isOpen) {
      bars[0].style.transform = 'translateY(7px) rotate(45deg)';
      bars[1].style.opacity   = '0';
      bars[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      bars[0].style.transform = '';
      bars[1].style.opacity   = '';
      bars[2].style.transform = '';
    }
  });

  // Close menu when a link is clicked
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      const bars = toggle.querySelectorAll('span');
      bars[0].style.transform = '';
      bars[1].style.opacity   = '';
      bars[2].style.transform = '';
    });
  });
})();


/* ============================================================
   2. SCROLL REVEAL ANIMATION
   Adds class "visible" to elements with class "reveal"
   when they enter the viewport.
   ============================================================ */
(function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  // Stagger delay for grid items
  revealEls.forEach((el, i) => {
    // Apply a stagger of 0–200ms based on position in a 3-column grid
    const delay = (i % 3) * 80;
    el.style.transitionDelay = `${delay}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // animate once only
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    }
  );

  revealEls.forEach(el => observer.observe(el));
})();


/* ============================================================
   3. ORDER FORM — Validation & AJAX Submission
   ============================================================ */
(function initOrderForm() {
  const form       = document.getElementById('orderForm');
  if (!form) return;

  const submitBtn  = document.getElementById('submitBtn');
  const successMsg = document.getElementById('successMsg');
  const errorMsg   = document.getElementById('errorMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // prevent native form submit

    // ── Client-side validation ──
    if (!validateForm(form)) return;

    // ── UI: loading state ──
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled    = true;
    successMsg.style.display = 'none';
    errorMsg.style.display   = 'none';

    try {
      /*
       * Encode form data as application/x-www-form-urlencoded
       * This is what the Cloudflare Worker expects.
       */
      const data = new URLSearchParams(new FormData(form)).toString();

      const response = await fetch(form.action, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    data,
      });

      if (response.ok) {
        // ── Success ──
        successMsg.style.display = 'block';
        form.reset();

        // Scroll to success message
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }

    } catch (err) {
      // ── Error ──
      console.error('Order submission error:', err);
      errorMsg.style.display = 'block';
    } finally {
      // Restore button
      submitBtn.textContent = 'Send My Order ✦';
      submitBtn.disabled    = false;
    }
  });

  /**
   * Simple inline validation — highlights empty required fields.
   * Returns true if valid, false if not.
   */
  function validateForm(form) {
    let valid = true;

    form.querySelectorAll('[required]').forEach(field => {
      // Clear previous error styles
      field.style.borderColor = '';
      field.style.boxShadow   = '';

      const value = field.value.trim();

      if (!value) {
        markInvalid(field, 'This field is required.');
        valid = false;
      } else if (field.type === 'email' && !isValidEmail(value)) {
        markInvalid(field, 'Please enter a valid email address.');
        valid = false;
      } else if (field.type === 'number' && (parseInt(value) < 1 || parseInt(value) > 20)) {
        markInvalid(field, 'Quantity must be between 1 and 20.');
        valid = false;
      }
    });

    return valid;
  }

  function markInvalid(field, message) {
    field.style.borderColor = 'var(--red-muted)';
    field.style.boxShadow   = '0 0 0 4px rgba(196,112,106,0.2)';
    field.focus();

    // Clear error styling on next input
    field.addEventListener('input', () => {
      field.style.borderColor = '';
      field.style.boxShadow   = '';
    }, { once: true });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
})();


/* ============================================================
   4. PRE-FILL PRODUCT FROM URL QUERY PARAM
   Allows shop links like: order.html?product=Cream+Market+Bag
   to pre-select the matching option in the product dropdown.
   ============================================================ */
(function prefillProductFromURL() {
  const select = document.getElementById('product');
  if (!select) return;

  const params      = new URLSearchParams(window.location.search);
  const productName = params.get('product');
  if (!productName) return;

  // Try to match the option value (case-insensitive)
  const options = Array.from(select.options);
  const match   = options.find(opt =>
    opt.value.toLowerCase() === productName.toLowerCase()
  );

  if (match) {
    select.value = match.value;
  }
})();


/* ============================================================
   5. SHOP FILTER BUTTON — Active state toggle (visual only)
   For a real filter, you'd show/hide product cards by category.
   ============================================================ */
(function initFilterButtons() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
})();
