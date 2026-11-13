"use client";

import { TourLaunch, useAppTour } from "./app-tour";

export function TourSettings() {
  const tour = useAppTour();
  return (
    <section className="card form-width" aria-label="App tutorial">
      <h2>App tutorial</h2>
      <p>
        A short walkthrough tailored to your account. Skip it anytime and replay
        it whenever you need.
      </p>
      <label className="tour-setting-label">
        <input
          type="checkbox"
          checked={tour.state.autoOfferEnabled}
          disabled={tour.pending}
          onChange={(event) => tour.setAutomatic(event.currentTarget.checked)}
        />
        <span>Show a welcome tutorial automatically</span>
      </label>
      <p className="small muted">
        The welcome is offered once to new accounts. Turning this on does not
        repeat a welcome already seen or skipped. Replay is always available.
      </p>
      <TourLaunch>Replay tour</TourLaunch>
      <p className="small muted" role="status">
        {tour.pending ? "Saving tutorial preference…" : ""}
      </p>
    </section>
  );
}
