import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

export type ShopLocation = { lat: number; lng: number };

const DEFAULT_CENTER: L.LatLngExpression = [30.0444, 31.2357];
const DEFAULT_ZOOM = 15;

const pinIcon = L.icon({
  iconUrl: 'leaflet/marker-icon.png',
  iconRetinaUrl: 'leaflet/marker-icon-2x.png',
  shadowUrl: 'leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-location-map-picker',
  standalone: true,
  template: `
    <div class="picker" dir="rtl">
      <p class="hint">
        حدد موقع المحل على الخريطة حتى يتمكن المندوب من فتح الخرائط والتوجه إليك.
      </p>

      <div class="search">
        <input
          type="search"
          [value]="addressQuery()"
          (input)="onAddressInput($any($event.target).value)"
          placeholder="ابحث بالعنوان أو اسم المكان…"
          aria-label="بحث بالعنوان"
          autocomplete="off"
        />
        @if (searching()) {
          <span class="search-hint">جارٍ البحث…</span>
        }
        @if (searchResults().length > 0) {
          <ul class="results" role="listbox">
            @for (hit of searchResults(); track hit.place_id) {
              <li>
                <button
                  type="button"
                  (mousedown)="$event.preventDefault()"
                  (click)="goToResult(hit)"
                >
                  {{ hit.display_name }}
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <div class="actions">
        <button type="button" class="btn" (click)="useMyLocation()" [disabled]="locating()">
          {{ locating() ? 'جارٍ تحديد موقعك…' : 'موقعي الحالي' }}
        </button>
        @if (hasPin()) {
          <button type="button" class="btn ghost" (click)="clearPin()">مسح الموقع</button>
        }
      </div>

      <div #mapHost class="map" role="application" aria-label="تحديد موقع المحل"></div>

      @if (error()) {
        <p class="err">{{ error() }}</p>
      } @else if (hasPin()) {
        <p class="ok">تم تحديد الموقع — اضغط على الخريطة لنقله</p>
      }
    </div>
  `,
  styles: `
    .picker { display: grid; gap: 0.65rem; }
    .hint {
      margin: 0;
      font-size: 0.82rem;
      color: var(--ink-muted, #64748b);
      line-height: 1.45;
    }
    .search { position: relative; display: grid; gap: 0.35rem; }
    .search input {
      min-height: 2.4rem;
      border: 1.5px solid var(--border, #e2e8f0);
      border-radius: 0.65rem;
      padding: 0.4rem 0.75rem;
      font: inherit;
      background: var(--input-bg, #fff);
      color: var(--ink, #0f172a);
    }
    .search-hint { font-size: 0.75rem; font-weight: 700; color: var(--ink-muted, #64748b); }
    .results {
      list-style: none; margin: 0; padding: 0; max-height: 10rem; overflow: auto;
      border: 1px solid var(--border, #e2e8f0); border-radius: 0.75rem;
      background: var(--surface, #fff); z-index: 5;
    }
    .results li + li { border-top: 1px solid var(--border, #e2e8f0); }
    .results button {
      width: 100%; border: 0; background: transparent; text-align: start;
      padding: 0.65rem 0.8rem; font: inherit; font-size: 0.82rem; cursor: pointer;
      color: var(--ink, #0f172a);
    }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .btn {
      min-height: 2.25rem; border: 0; border-radius: 0.65rem; padding: 0 0.85rem;
      background: var(--accent, #10b880); color: #fff; font: inherit; font-weight: 700; cursor: pointer;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn.ghost {
      background: transparent; color: var(--ink, #0f172a);
      border: 1.5px solid var(--border, #e2e8f0);
    }
    .map {
      height: 16rem; width: 100%; border-radius: 0.85rem;
      border: 1px solid var(--border, #e2e8f0); overflow: hidden; z-index: 0;
    }
    .err {
      margin: 0; font-size: 0.8rem; color: var(--danger, #991b1b);
      background: var(--danger-bg, #fef2f2); padding: 0.5rem 0.7rem; border-radius: 0.55rem;
    }
    .ok { margin: 0; font-size: 0.8rem; font-weight: 700; color: #0d9a6a; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationMapPicker implements AfterViewInit, OnDestroy {
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);
  readonly locationChange = output<ShopLocation | null>();

  private readonly mapHost =
    viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  protected readonly locating = signal(false);
  protected readonly searching = signal(false);
  protected readonly addressQuery = signal('');
  protected readonly searchResults = signal<NominatimHit[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly hasPin = signal(false);

  private map?: L.Map;
  private marker?: L.Marker;
  private ready = false;
  private skipSync = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchAbort?: AbortController;
  private searchSeq = 0;

  constructor() {
    effect(() => {
      const lat = this.lat();
      const lng = this.lng();
      if (!this.ready || !this.map || this.skipSync) {
        this.skipSync = false;
        return;
      }
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        this.setPin(L.latLng(lat, lng), false);
      } else {
        this.clearPin(false);
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.mapHost().nativeElement;
    const lat = this.lat();
    const lng = this.lng();
    const center: L.LatLngExpression =
      lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

    this.map = L.map(el, { center, zoom: DEFAULT_ZOOM, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setPin(e.latlng, true);
    });

    this.ready = true;
    if (lat != null && lng != null) {
      this.setPin(L.latLng(lat, lng), false);
    }

    queueMicrotask(() => this.map?.invalidateSize());
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchAbort?.abort();
    this.marker?.remove();
    this.map?.remove();
    this.map = undefined;
  }

  protected useMyLocation(): void {
    if (!navigator.geolocation) {
      this.error.set('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    this.locating.set(true);
    this.error.set(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        this.map?.setView(latlng, 17);
        this.setPin(latlng, true);
      },
      (err) => {
        this.locating.set(false);
        this.error.set(
          err.code === 1
            ? 'يجب السماح بالوصول للموقع'
            : 'تعذر تحديد موقعك. حاول مرة أخرى',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  protected onAddressInput(value: string): void {
    this.addressQuery.set(value);
    this.error.set(null);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 3) {
      this.searchAbort?.abort();
      this.searching.set(false);
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => void this.fetchSuggestions(q), 350);
  }

  protected async fetchSuggestions(q: string): Promise<void> {
    this.searchAbort?.abort();
    const abort = new AbortController();
    this.searchAbort = abort;
    const seq = ++this.searchSeq;
    this.searching.set(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '5');
      const res = await fetch(url.toString(), {
        signal: abort.signal,
        headers: { Accept: 'application/json', 'Accept-Language': 'ar,en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const hits = (await res.json()) as NominatimHit[];
      if (seq !== this.searchSeq) return;
      this.searchResults.set(hits);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if (seq !== this.searchSeq) return;
      this.searchResults.set([]);
      this.error.set('تعذر البحث عن العنوان');
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  protected goToResult(hit: NominatimHit): void {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.map) return;
    const latlng = L.latLng(lat, lng);
    this.map.setView(latlng, 17);
    this.setPin(latlng, true);
    this.addressQuery.set(hit.display_name);
    this.searchResults.set([]);
  }

  protected clearPin(emit = true): void {
    this.marker?.remove();
    this.marker = undefined;
    this.hasPin.set(false);
    if (emit) {
      this.skipSync = true;
      this.locationChange.emit(null);
    }
  }

  private setPin(latlng: L.LatLng, emit: boolean): void {
    if (!this.map) return;
    if (!this.marker) {
      this.marker = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(
        this.map,
      );
      this.marker.on('dragend', () => {
        const p = this.marker?.getLatLng();
        if (!p) return;
        this.skipSync = true;
        this.locationChange.emit({ lat: p.lat, lng: p.lng });
      });
    } else {
      this.marker.setLatLng(latlng);
    }
    this.hasPin.set(true);
    this.error.set(null);
    if (emit) {
      this.skipSync = true;
      this.locationChange.emit({ lat: latlng.lat, lng: latlng.lng });
    }
  }
}

interface NominatimHit {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}
