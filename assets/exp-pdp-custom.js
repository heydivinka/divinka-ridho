/**
 * EXP PDP Custom Script
 * Handles custom PDP interactions:
 * - Variant selection sync with color swatches & size cards
 * - Sticky Add to Cart bar triggers & desktop scroll observer
 * - 360° interactive viewer modal with drag rotation
 * - Mobile wishlist toggle with localStorage persistence
 * - Cross-sell item quick-add
 */

let expStickyObserver = null;

document.addEventListener('DOMContentLoaded', () => {
  initExpPdp();
});

// Re-bind section-scoped observers when Shopify Theme Editor live-updates schema settings
document.addEventListener('shopify:section:load', () => {
  setupStickyAtcObserver(true);
  init360Modal();
  initSliderObserver();
});

function initExpPdp() {
  initStickyAtc();
  initColorSwatchesSync();
  initSizeCardsSync();
  init360Modal();
  initWishlistToggle();
  initCrossSell();
  initSliderObserver();
}

/**
 * 1. Sticky Add to Cart Synchronization (Event Delegation + Live Theme Editor Support)
 */
function initStickyAtc() {
  // Delegated click handler so it survives Theme Editor section reloads
  document.addEventListener('click', (e) => {
    const stickyBtn = e.target.closest('.exp-sticky-atc__btn');
    if (!stickyBtn) return;

    e.preventDefault();
    const currentMainBtn = document.querySelector('.product-form__submit');
    if (currentMainBtn) {
      if (currentMainBtn.disabled || currentMainBtn.getAttribute('aria-disabled') === 'true') return;
      currentMainBtn.click();
    } else {
      const form = document.querySelector('product-form form');
      if (form) form.requestSubmit();
    }
  });

  setupStickyAtcObserver(false);
}

function setupStickyAtcObserver(isEditorReload) {
  if (expStickyObserver) {
    expStickyObserver.disconnect();
    expStickyObserver = null;
  }

  const stickyAtc = document.querySelector('.exp-sticky-atc');
  const mainBuyBtn = document.querySelector('.product-form__submit');
  if (!stickyAtc || !mainBuyBtn) return;

  const evaluateVisibility = () => {
    const rect = mainBuyBtn.getBoundingClientRect();
    const scrolledPast = rect.bottom < 0;
    stickyAtc.classList.toggle('is-visible', scrolledPast);
  };

  // Always attach observer (works even when switching Mobile <-> Desktop preview without reload)
  expStickyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        stickyAtc.classList.add('is-visible');
      } else {
        stickyAtc.classList.remove('is-visible');
      }
    });
  }, { threshold: 0.1 });

  expStickyObserver.observe(mainBuyBtn);

  // Immediately evaluate visibility on reload or in Theme Editor designMode
  if (isEditorReload || (window.Shopify && window.Shopify.designMode)) {
    evaluateVisibility();
    // In Theme Editor when section is just reloaded after tweaking sticky ATC settings, show it briefly if scrolled or at top
    if (isEditorReload && window.Shopify && window.Shopify.designMode && window.innerWidth >= 750) {
      stickyAtc.classList.add('is-visible');
    }
  } else {
    evaluateVisibility();
  }
}

/**
 * 2. Color Swatches Sync (Event Delegation — survives Dawn <variant-selects> DOM swap)
 */
function initColorSwatchesSync() {
  document.addEventListener('change', (e) => {
    const radio = e.target.closest('.exp-swatch-item input[type="radio"]');
    if (!radio) return;
    const section = radio.closest('.exp-color-section');
    const colorSelectedName = section?.querySelector('.exp-color-selected-name');
    if (colorSelectedName) {
      colorSelectedName.textContent = radio.value.toUpperCase();
    }
    updateStickyVariantLabel();
  });
}

/**
 * 3. Size Cards Sync (Event Delegation + Dawn PUB_SUB variantChange subscription)
 */
function initSizeCardsSync() {
  document.addEventListener('change', (e) => {
    const radio = e.target.closest('.exp-size-card input[type="radio"]');
    if (!radio) return;
    const section = radio.closest('.exp-size-section');
    const sizeSelectedName = section?.querySelector('.exp-size-selected-name');
    if (sizeSelectedName) {
      sizeSelectedName.textContent = radio.value.toUpperCase();
    }
    updateStickyVariantLabel();
  });

  // Subscribe to Dawn's native variantChange event to sync Sticky ATC price, image, and availability
  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.variantChange) {
    subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
      const variant = data?.variant;
      syncStickyAtcWithVariant(variant, data?.html);
    });
  }
}

function updateStickyVariantLabel() {
  const stickyVariantText = document.querySelector('.exp-sticky-atc__variant');
  if (!stickyVariantText) return;

  const selectedValues = Array.from(
    document.querySelectorAll('variant-selects fieldset input[type="radio"]:checked, variant-selects select')
  )
    .map((el) => el.value)
    .filter(Boolean);

  if (selectedValues.length > 0) {
    stickyVariantText.textContent = selectedValues.join(' • ');
  }
}

function syncStickyAtcWithVariant(variant, html) {
  const stickyAtc = document.querySelector('.exp-sticky-atc');
  if (!stickyAtc) return;

  const stickyVariantText = stickyAtc.querySelector('.exp-sticky-atc__variant');
  const stickyCurrent = stickyAtc.querySelector('.exp-sticky-atc__current');
  const stickyCompare = stickyAtc.querySelector('.exp-sticky-atc__compare');
  const stickyBtn = stickyAtc.querySelector('.exp-sticky-atc__btn');
  const stickyBtnSpan = stickyBtn?.querySelector('span');
  const stickyThumb = stickyAtc.querySelector('.exp-sticky-atc__thumb');

  if (!variant) {
    if (stickyBtn) stickyBtn.disabled = true;
    if (stickyBtnSpan) stickyBtnSpan.textContent = 'Tidak Tersedia';
    return;
  }

  if (stickyVariantText && variant.title && variant.title !== 'Default Title') {
    stickyVariantText.textContent = variant.title.replace(/\s*\/\s*/g, ' • ');
  }

  // Extract formatted price from Dawn's fresh server-rendered price block when available
  const freshPriceContainer = html?.querySelector('.exp-price-container');
  const freshCurrency = freshPriceContainer?.querySelector('.exp-price-currency')?.textContent?.trim() || 'Rp';
  const freshAmount = freshPriceContainer?.querySelector('.exp-price-amount')?.textContent?.trim();
  const freshCompare = freshPriceContainer?.querySelector('.exp-price-compare s')?.textContent?.trim();

  const customBtnLabel = stickyAtc.dataset.buttonLabel || 'Tambah ke Keranjang';

  if (freshAmount) {
    if (stickyCurrent) stickyCurrent.textContent = `${freshCurrency} ${freshAmount}`;
    if (stickyBtnSpan) {
      stickyBtnSpan.textContent = variant.available
        ? `${customBtnLabel} • ${freshCurrency} ${freshAmount}`
        : 'Stok Habis';
    }
  }

  if (stickyCompare) {
    if (freshCompare) {
      stickyCompare.textContent = `${freshCurrency} ${freshCompare}`;
      stickyCompare.style.display = '';
    } else {
      stickyCompare.style.display = 'none';
    }
  }

  if (stickyBtn) {
    stickyBtn.disabled = !variant.available;
  }

  if (stickyThumb && stickyThumb.tagName === 'IMG' && variant.featured_image?.src) {
    stickyThumb.src = variant.featured_image.src;
  }
}

/**
 * 4. 360 Interactive Viewer Modal
 */
function init360Modal() {
  const btn360 = document.querySelectorAll('.exp-btn-360');
  const modal = document.querySelector('.exp-360-modal');
  const closeBtn = document.querySelector('.exp-360-modal__close');
  const viewerArea = document.querySelector('.exp-360-viewer-area');
  const viewerImg = document.querySelector('.exp-360-viewer-area img');

  if (!modal) return;

  btn360.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeModal = () => {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // Interactive 360 drag rotation
  if (viewerArea && viewerImg) {
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;

    const onStart = (clientX) => {
      isDragging = true;
      startX = clientX;
    };

    const onMove = (clientX) => {
      if (!isDragging) return;
      const deltaX = clientX - startX;
      currentRotation += deltaX * 0.4;
      startX = clientX;
      viewerImg.style.transform = `rotateY(${currentRotation}deg)`;
    };

    const onEnd = () => {
      isDragging = false;
    };

    viewerArea.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    viewerArea.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', onEnd);
  }
}

/**
 * 5. Wishlist Heart Toggle
 */
function initWishlistToggle() {
  const wishlistBtn = document.querySelector('.exp-mobile-header__wishlist');
  if (!wishlistBtn) return;

  const productId = wishlistBtn.dataset.productId || 'always-pan';
  const isSaved = localStorage.getItem(`exp_wishlist_${productId}`) === 'true';

  if (isSaved) {
    wishlistBtn.classList.add('is-active');
  }

  wishlistBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const active = wishlistBtn.classList.toggle('is-active');
    localStorage.setItem(`exp_wishlist_${productId}`, active);
  });
}

/**
 * 6. Cross-sell & Related Products "+ Tambah" Quick-Add (Event Delegation for async <product-recommendations>)
 */
function initCrossSell() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.exp-cross-sell-btn, .exp-related-quick-add');
    if (!btn || btn.disabled) return;

    e.preventDefault();
    const variantId = btn.dataset.variantId;
    const originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    btn.dataset.originalHtml = originalHtml;

    if (!variantId) {
      btn.textContent = '✓ Ditambahkan';
      btn.classList.add('is-added');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Menambahkan...';

      const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      const payload = { id: Number(variantId), quantity: 1 };
      if (cart && typeof cart.getSectionsToRender === 'function') {
        payload.sections = cart.getSectionsToRender().map((s) => s.id).join(',');
        payload.sections_url = window.location.pathname;
        if (typeof cart.setActiveElement === 'function') {
          cart.setActiveElement(btn);
        }
      }

      const addUrl = (window.routes && window.routes.cart_add_url) ? `${window.routes.cart_add_url}.js` : '/cart/add.js';
      const res = await fetch(addUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && !data.status) {
        btn.textContent = '✓ Ditambahkan';
        btn.classList.add('is-added');

        if (window.publish && window.PUB_SUB_EVENTS) {
          window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
            source: 'exp-related-quick-add',
            productVariantId: variantId,
            cartData: data
          });
        }

        if (cart && typeof cart.renderContents === 'function') {
          if (cart.classList.contains('is-empty')) cart.classList.remove('is-empty');
          cart.renderContents(data);
        }

        setTimeout(() => {
          btn.disabled = false;
          btn.classList.remove('is-added');
          btn.innerHTML = originalHtml;
        }, 2200);
      } else {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    } catch (err) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });
}

/**
 * 7. Slider Dot & Counter Observer
 */
function initSliderObserver() {
  const slider = document.querySelector('.product__media-list.slider--mobile');
  const dots = document.querySelectorAll('.exp-slider-dot');
  const counterCurrent = document.querySelector('.exp-slider-counter--current');

  if (!slider) return;

  const slides = slider.querySelectorAll('.product__media-item');
  if (slides.length <= 1) return;

  const getSlideWidth = () => slides[0].offsetWidth || slider.clientWidth || 1;

  const updateActiveSlide = (activeIndex) => {
    const clamped = Math.max(0, Math.min(activeIndex, slides.length - 1));
    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === clamped);
    });
    if (counterCurrent) {
      counterCurrent.textContent = (clamped + 1);
    }
  };

  slider.addEventListener('scroll', () => {
    updateActiveSlide(Math.round(slider.scrollLeft / getSlideWidth()));
  }, { passive: true });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      slider.scrollTo({ left: idx * getSlideWidth(), behavior: 'smooth' });
      updateActiveSlide(idx);
    });
  });

  // Enable smooth cursor (mouse) drag-to-slide on mobile viewport
  let isDown = false;
  let startX = 0;
  let startScrollLeft = 0;
  let wasDragged = false;

  slider.addEventListener('dragstart', (e) => e.preventDefault());

  slider.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || window.innerWidth >= 750) return;
    isDown = true;
    wasDragged = false;
    startX = e.pageX;
    startScrollLeft = slider.scrollLeft;
    slider.classList.add('is-dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 5) {
      wasDragged = true;
    }
    slider.scrollLeft = startScrollLeft - dx;
  });

  const finishDrag = () => {
    if (!isDown) return;
    isDown = false;
    slider.classList.remove('is-dragging');

    const slideWidth = getSlideWidth();
    const startIdx = Math.round(startScrollLeft / slideWidth);
    const delta = slider.scrollLeft - startScrollLeft;
    let targetIdx = startIdx;

    if (Math.abs(delta) > slideWidth * 0.15) {
      targetIdx = delta > 0 ? startIdx + 1 : startIdx - 1;
    }
    targetIdx = Math.max(0, Math.min(targetIdx, slides.length - 1));

    slider.scrollTo({ left: targetIdx * slideWidth, behavior: 'smooth' });
    updateActiveSlide(targetIdx);

    if (wasDragged) {
      setTimeout(() => { wasDragged = false; }, 120);
    }
  };

  window.addEventListener('mouseup', finishDrag);
  slider.addEventListener('mouseleave', finishDrag);

  // Prevent Dawn lightbox modal from opening accidentally right after dragging
  slider.addEventListener('click', (e) => {
    if (wasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}
