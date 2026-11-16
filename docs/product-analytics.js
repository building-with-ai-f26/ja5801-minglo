/* Minglo Product Page only. The application keeps its separate, account-scoped consent. */
(() => {
  "use strict";
  const canonical = "https://building-with-ai-f26.github.io/ja5801-minglo/";
  const key = "minglo-product-analytics-v1";
  const allow = document.getElementById("analytics-allow");
  const decline = document.getElementById("analytics-decline");
  const status = document.getElementById("analytics-status");
  const live =
    location.origin === new URL(canonical).origin &&
    ["/ja5801-minglo/", "/ja5801-minglo/index.html"].includes(
      location.pathname,
    );
  const verification =
    new URLSearchParams(location.search).get("minglo_analytics_test") === "1";
  const identity = crypto.randomUUID();
  let choice = null;
  let initialized = false;
  let ready = false;
  let pageCaptured = false;
  try {
    choice = localStorage.getItem(key);
  } catch {
    /* Fresh consent required. */
  }
  const permitted = () => live && choice === "on";
  const update = (stored = true) => {
    status.textContent = permitted()
      ? `Page analytics is allowed${verification ? " for a labeled verification visit" : ""}.${stored ? "" : " Your browser could not remember this choice."}`
      : live
        ? `Page analytics is off.${stored ? "" : " Your browser could not save the change; clear this site's saved data to remove a previous choice."}`
        : "Page analytics stays off in local previews.";
    allow.textContent = permitted()
      ? "Page analytics allowed"
      : "Allow page analytics";
    allow.disabled = !live || permitted();
    decline.disabled = !live;
    decline.textContent = permitted()
      ? "Turn page analytics off"
      : "Keep analytics off";
  };
  const clean = (event) => {
    if (
      !permitted() ||
      !event ||
      !["$pageview", "product_button_clicked"].includes(event.event)
    )
      return null;
    const properties = {
      token: window.MINGLO_POSTHOG_PUBLIC_TOKEN,
      distinct_id: identity,
      $geoip_disable: true,
      $process_person_profile: false,
      schema_version: 1,
      environment: verification ? "verification" : "production",
      capture_source: "browser",
      surface: "product_page",
    };
    if (event.event === "$pageview") {
      properties.page_name = "product_page";
      // This is a fixed public URL, never the visitor's actual query/referrer/hash.
      properties.$current_url = canonical;
      properties.$pathname = "/ja5801-minglo/";
    } else {
      const input = event.properties || {};
      if (input.button !== "open_minglo" || !["hero"].includes(input.placement))
        return null;
      properties.button = "open_minglo";
      properties.placement = input.placement;
    }
    const { $set, $set_once, ...transport } = event;
    return { ...transport, properties };
  };
  const pageview = () => {
    if (!permitted() || !ready || pageCaptured) return;
    pageCaptured = true;
    window.posthog.capture("$pageview");
  };
  const start = () => {
    if (!permitted()) return;
    if (initialized) {
      if (ready) window.posthog.opt_in_capturing({ captureEventName: false });
      pageview();
      return;
    }
    initialized = true;
    window.initializeMingloProductPostHog({
      api_host: "https://us.i.posthog.com",
      defaults: "2026-08-30",
      strict_script_versioning: true,
      ip: false,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      rageclick: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      enable_recording_console_log: false,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      opt_out_useragent_filter: true,
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      persistence: "memory",
      disable_persistence: true,
      cross_subdomain_cookie: false,
      save_referrer: false,
      save_campaign_params: false,
      person_profiles: "never",
      request_batching: false,
      debug: false,
      on_request_error: () => {},
      bootstrap: { distinctID: identity, isIdentifiedID: false },
      before_send: clean,
      loaded: (posthog) => {
        ready = true;
        if (!permitted()) {
          posthog.opt_out_capturing();
          return;
        }
        posthog.opt_in_capturing({ captureEventName: false });
        pageview();
      },
    });
  };
  const stop = () => {
    if (initialized && ready) {
      window.posthog.opt_out_capturing();
      window.posthog.reset();
    }
  };
  const save = (next) => {
    choice = next;
    let stored = true;
    try {
      localStorage.setItem(key, next);
    } catch {
      stored = false;
    }
    if (permitted()) start();
    else stop();
    update(stored);
  };
  allow.addEventListener("click", () => save("on"));
  decline.addEventListener("click", () => save("off"));
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    choice = event.key === null ? null : event.newValue;
    if (permitted()) start();
    else stop();
    update();
  });
  document.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest('a[data-product-action="open_minglo"]')
        : null;
    if (!target || !permitted() || !ready) return;
    // Navigation remains immediate; a telemetry failure cannot block the product.
    try {
      window.posthog.capture(
        "product_button_clicked",
        {
          button: "open_minglo",
          placement: target.dataset.placement,
        },
        { transport: "sendBeacon", send_instantly: true },
      );
    } catch {
      /* Product links work even if the analytics transport is blocked. */
    }
  });
  update();
  start();
})();
