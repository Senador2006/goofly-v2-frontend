import { useCallback, useId, useState } from 'react'
import { Icon } from '../common/Icon'
import {
  googleMapsPlaceUrl,
  resolveActivityCoordinates,
} from '../../utils/activityCoordinates'
import { GooglePlaceAutocompleteField } from '../planning/GooglePlaceAutocompleteField'
import { hasGoogleMapsApiKey } from '../../services/googleMapsPlacesLoader'

function minutesBetweenStarts(startStr, endStr) {
  if (!startStr || !endStr) return null
  const [sh, sm] = String(startStr).split(':').map(Number)
  const [eh, em] = String(endStr).split(':').map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return null
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins : null
}

function formatDuration(act, startResolved, endResolved) {
  const fromWindow = minutesBetweenStarts(startResolved, endResolved)
  if (fromWindow != null) {
    const h = Math.round((fromWindow / 60) * 10) / 10
    return `${h}h`
  }
  if (act.duration) return act.duration
  if (act.duration_minutes) {
    const h = Math.round((act.duration_minutes / 60) * 10) / 10
    return `${h}h`
  }
  return '2h'
}

/** @param {{ source?: string }} act */
function sourceBadgeLabel(act) {
  const s = String(act.source || '').trim()
  if (s === 'tdv_like') return 'TDV'
  return null
}

/**
 * Resolve a descrição da atividade tolerando todas as variações que o agente n8n /
 * LLM pode emitir e que o backend pode espelhar (description, notes, reasoning,
 * summary, aiReasoning, ai_reasoning). Strings genéricas/placeholders são tratadas
 * como vazias para evitar ruído no card.
 *
 * @param {Record<string, any>} act
 * @returns {string | null}
 */
function resolveActivityDescription(act) {
  if (!act || typeof act !== 'object') return null
  const candidates = [
    act.description,
    act.notes,
    act.reasoning,
    act.summary,
    act.aiReasoning,
    act.ai_reasoning,
  ]
  for (const raw of candidates) {
    if (raw == null) continue
    const text = String(raw).trim()
    if (!text) continue
    const lower = text.toLowerCase()
    if (text.length < 5) continue
    if (['tbd', 'todo', 'placeholder', 'n/a', '-', '—', 'atividade sugerida'].includes(lower)) continue
    return text
  }
  return null
}

/** @param {string} raw */
function normalizeHttpUrl(raw) {
  if (raw == null) return ''
  let u = String(raw).trim()
  if (!u) return ''
  u = u.replace(/[.,;:!?)\]}>]+$/, '').replace(/^<+|>+$/g, '')
  return /^https?:\/\//i.test(u) ? u : ''
}

/** @param {string} text */
function extractHttpUrls(text) {
  if (!text || typeof text !== 'string') return []
  const re = /\bhttps?:\/\/\S+/gi
  const seen = new Set()
  const out = []
  for (const m of text.matchAll(re)) {
    const n = normalizeHttpUrl(m[0])
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

/** @param {unknown} raw */
function collectUrlsFromStructuredField(raw, labelByUrl) {
  if (raw == null) return
  if (typeof raw === 'string') {
    const n = normalizeHttpUrl(raw)
    if (n) labelByUrl.set(n, labelByUrl.get(n) ?? null)
    return
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        collectUrlsFromStructuredField(item, labelByUrl)
      } else if (item && typeof item === 'object') {
        const u =
          normalizeHttpUrl(item.url) ||
          normalizeHttpUrl(item.href) ||
          normalizeHttpUrl(item.link) ||
          normalizeHttpUrl(item.ticketUrl)
        if (u) {
          const lab =
            typeof item.label === 'string' && item.label.trim()
              ? item.label.trim()
              : typeof item.name === 'string' && item.name.trim()
                ? item.name.trim()
                : typeof item.title === 'string' && item.title.trim()
                  ? item.title.trim()
                  : null
          labelByUrl.set(u, labelByUrl.get(u) ?? lab ?? null)
        }
      }
    }
  }
}

/**
 * Ingressos/réservas: aceita vários nomes que o agente/backend podem usar.
 * @param {Record<string, any>} act
 * @returns {{ required: boolean, hint: string, links: Array<{ url: string, label: string | null }> }}
 */
function resolveTicketInfo(act) {
  if (!act || typeof act !== 'object')
    return { required: false, hint: '', links: [] }

  const required =
    act.ticketRequired === true ||
    act.requiresTicket === true ||
    act.ticket_required === true ||
    act.needs_ticket === true

  const hint = String(act.ticketPurchaseHint || act.ticket_purchase_hint || '').trim()

  /** @type {Map<string, string | null>} */
  const byUrl = new Map()

  collectUrlsFromStructuredField(act.ticketUrl, byUrl)
  collectUrlsFromStructuredField(act.ticket_url, byUrl)
  collectUrlsFromStructuredField(act.bookingUrl, byUrl)
  collectUrlsFromStructuredField(act.booking_url, byUrl)
  collectUrlsFromStructuredField(act.booking_link, byUrl)
  collectUrlsFromStructuredField(act.bookingLink, byUrl)
  collectUrlsFromStructuredField(act.reservationUrl, byUrl)
  collectUrlsFromStructuredField(act.reservation_url, byUrl)
  collectUrlsFromStructuredField(act.officialTicketUrl, byUrl)
  collectUrlsFromStructuredField(act.official_ticket_url, byUrl)
  collectUrlsFromStructuredField(act.ticketUrls, byUrl)
  collectUrlsFromStructuredField(act.ticket_urls, byUrl)
  collectUrlsFromStructuredField(act.purchaseLinks, byUrl)
  collectUrlsFromStructuredField(act.purchase_links, byUrl)

  for (const u of extractHttpUrls(hint)) {
    collectUrlsFromStructuredField(u, byUrl)
  }

  if (required && byUrl.size === 0) {
    const desc = resolveActivityDescription(act)
    if (desc) {
      for (const u of extractHttpUrls(desc)) {
        collectUrlsFromStructuredField(u, byUrl)
      }
    }
  }

  const links = [...byUrl.entries()].map(([url, label]) => ({ url, label }))

  return { required, hint, links }
}

export function ItineraryActivityCard({
  act,
  index,
  isLast,
  editing = false,
  draft,
  onDraftPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false,
  dayPickerValue,
  dayPickerOptions = [],
  onDayChange,
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)

  const effective = editing ? draft : act

  const start = effective?.startTime || effective?.start_time || effective?.time || '09:00'
  const end = effective?.endTime || effective?.end_time
  const scheduleLabel =
    typeof end === 'string' && end.trim() ? `${start}–${String(end).trim()}` : start
  const title = effective?.title || effective?.name || effective?.placeName || `Atividade ${index + 1}`
  const description = resolveActivityDescription(effective)
  const badge = sourceBadgeLabel(effective)
  const ticket = resolveTicketInfo(effective || act)

  const toggle = useCallback(() => {
    setOpen((v) => !v)
  }, [])

  return (
    <div className={`relative pl-8 ${isLast ? '' : 'pb-8'}`}>
      {!isLast && (
        <div className="absolute left-0 top-3 bottom-0 w-px border-l-2 border-dashed border-primary/70" aria-hidden />
      )}
      <div className="absolute left-[-5px] top-1 size-3 rounded-full bg-primary border-4 border-white dark:border-card-dark ring-2 ring-primary z-10" />
      <article className="rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-[#23220f] overflow-hidden shadow-sm ring-inset ring-primary/25">
        {(effective?.image_url || act?.image_url) ? (
          <div
            className="h-36 sm:h-40 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${effective?.image_url || act.image_url})` }}
            role="img"
            aria-label={title}
          />
        ) : null}
        {editing ? (
          <CardEditFields
            index={index}
            title={title}
            scheduleLabelHint={scheduleLabel}
            ticket={ticket}
            badge={badge}
            draft={draft}
            onDraftPatch={onDraftPatch}
            onRemove={onRemove}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            disableMoveUp={disableMoveUp}
            disableMoveDown={disableMoveDown}
            dayPickerValue={dayPickerValue}
            dayPickerOptions={dayPickerOptions}
            onDayChange={onDayChange}
          />
        ) : (
          <CardBody
            scheduleLabel={scheduleLabel}
            act={act}
            title={title}
            description={description}
            startResolved={start}
            endResolved={typeof end === 'string' ? end.trim() : null}
            badge={badge}
            ticket={ticket}
            open={open}
            onToggle={toggle}
            panelId={panelId}
          />
        )}
      </article>
    </div>
  )
}

function CardEditFields({
  index,
  title,
  scheduleLabelHint,
  ticket,
  badge,
  draft,
  onDraftPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  dayPickerValue,
  dayPickerOptions,
  onDayChange,
}) {
  const rawDesc =
    draft.description ??
    draft.notes ??
    draft.summary ??
    draft.aiReasoning ??
    draft.ai_reasoning ??
    ''
  const descText = typeof rawDesc === 'string' ? rawDesc : ''

  const st = draft.startTime || draft.start_time || draft.time || '09:00'
  const et = draft.endTime || draft.end_time || ''

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Parada {index + 1}</span>
        {badge ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary bg-border-light/80 dark:bg-border-dark px-2 py-0.5 rounded">
            {badge}
          </span>
        ) : null}
        {ticket.required ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
            Ingresso
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-text-secondary">
          Início
          <input
            type="text"
            className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-2.5 py-2 text-sm font-semibold text-[#1c1c0d] dark:text-white"
            value={st}
            onChange={(e) =>
              onDraftPatch({ startTime: e.target.value, start_time: e.target.value, time: e.target.value })
            }
            placeholder="09:00"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-text-secondary">
          Fim (opcional)
          <input
            type="text"
            className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-2.5 py-2 text-sm font-semibold text-[#1c1c0d] dark:text-white"
            value={et}
            onChange={(e) => onDraftPatch({ endTime: e.target.value, end_time: e.target.value })}
            placeholder="—"
            autoComplete="off"
          />
        </label>
        {dayPickerOptions.length > 0 ? (
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-text-secondary col-span-2 sm:min-w-[7rem]">
            Dia
            <select
              className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-2.5 py-2 text-sm font-semibold text-[#1c1c0d] dark:text-white"
              value={String(dayPickerValue)}
              onChange={(e) => onDayChange(Number(e.target.value))}
            >
              {dayPickerOptions.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p className="text-[10px] text-text-secondary/80 -mt-1">
        Horários no formato 24h (ex.: {scheduleLabelHint}).
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Título</span>
        {hasGoogleMapsApiKey() ? (
          <>
            <GooglePlaceAutocompleteField
              id={`activity-title-ac-${draft.id ?? index}`}
              resultKind="place"
              value={title}
              disabled={false}
              placeholder="Busque um lugar (ex.: Torre Eiffel)…"
              className="itinerary-activity-ac-frame relative z-[30] w-full min-h-[2.75rem] overflow-visible rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910]"
              onDraftChange={(text) =>
                onDraftPatch({ title: text, name: text, placeName: text })
              }
              onResolved={(patch) => {
                const next = {}
                const resolvedName = patch.name || patch.city
                if (resolvedName) {
                  next.title = resolvedName
                  next.name = resolvedName
                  next.placeName = resolvedName
                }
                if (patch.coordinates) next.coordinates = patch.coordinates
                if (Object.keys(next).length > 0) onDraftPatch(next)
              }}
            />
            <span className="text-[10px] text-text-secondary/80">
              Escolha uma sugestão do Google para fixar o local exato no mapa.
            </span>
          </>
        ) : (
          <input
            type="text"
            className="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-3 py-2.5 text-sm font-bold text-[#1c1c0d] dark:text-white"
            value={title}
            onChange={(e) =>
              onDraftPatch({
                title: e.target.value,
                name: e.target.value,
                placeName: e.target.value,
              })
            }
          />
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Descrição / notas</span>
        <textarea
          className="w-full min-h-[5.5rem] rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#1a1910] px-3 py-2.5 text-sm text-[#1c1c0d] dark:text-white leading-relaxed resize-y"
          value={descText}
          onChange={(e) => onDraftPatch({ description: e.target.value })}
          placeholder="O que você quer fazer nesta parada?"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={disableMoveUp}
          onClick={onMoveUp}
          className="inline-flex items-center justify-center rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-white/[0.06] px-2.5 py-2 text-sm font-bold text-[#1c1c0d] dark:text-white disabled:opacity-35 disabled:pointer-events-none min-h-[2.25rem]"
          title="Mover para cima"
        >
          <Icon name="arrow_upward" className="text-lg" aria-hidden />
        </button>
        <button
          type="button"
          disabled={disableMoveDown}
          onClick={onMoveDown}
          className="inline-flex items-center justify-center rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-white/[0.06] px-2.5 py-2 text-sm font-bold text-[#1c1c0d] dark:text-white disabled:opacity-35 disabled:pointer-events-none min-h-[2.25rem]"
          title="Mover para baixo"
        >
          <Icon name="arrow_downward" className="text-lg" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400 min-h-[2.25rem] ml-auto"
        >
          <Icon name="delete" className="text-sm" aria-hidden />
          Remover
        </button>
      </div>
    </div>
  )
}

function linkHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? url
  }
}

function CardBody({
  scheduleLabel,
  act,
  title,
  description,
  startResolved,
  endResolved,
  badge,
  ticket,
  open,
  onToggle,
  panelId,
}) {
  const hasTicketBox = ticket.required || !!ticket.hint || ticket.links.length > 0
  const mapCoords = resolveActivityCoordinates(act)
  return (
    <>
      <button
        type="button"
        id={`${panelId}-trigger`}
        className="w-full text-left p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2.5 py-1 rounded-full">
            <Icon name="schedule" className="text-sm" />
            {scheduleLabel}
          </span>
          <div className="flex items-center gap-2">
            {ticket.required ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded"
                title="Costuma exigir ingresso ou bilhete"
              >
                Ingresso
              </span>
            ) : null}
            {badge ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wide text-text-secondary bg-border-light/80 dark:bg-border-dark px-2 py-0.5 rounded"
                title={act.source === 'tdv_like' ? 'Preferência TDV' : 'Sugerido pela IA'}
              >
                {badge}
              </span>
            ) : null}
            <span className="text-[11px] font-semibold text-text-secondary">
              {formatDuration(act, startResolved, endResolved)}
            </span>
            <Icon
              name={open ? 'expand_less' : 'expand_more'}
              className="text-lg text-text-secondary shrink-0"
              aria-hidden
            />
          </div>
        </div>
        <h3 className="text-base font-bold text-[#1c1c0d] dark:text-white leading-snug pr-6">{title}</h3>
        {!open ? (
          <p className="text-[11px] text-text-secondary/80 mt-1.5 leading-snug">Toque para ver detalhes</p>
        ) : null}
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        hidden={!open}
        className={open ? 'border-t border-border-light dark:border-border-dark' : ''}
      >
        {open ? (
          <div className="px-4 pb-4 pt-3">
            {description ? (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{description}</p>
            ) : (
              <p className="text-xs italic text-text-secondary/70 leading-relaxed">
                {act.source === 'tdv_like'
                  ? 'Parada selecionada nas suas preferências (TDV).'
                  : 'Sugestão da IA para este horário do roteiro.'}
              </p>
            )}
            {mapCoords ? (
              <div className="mt-4">
                <a
                  href={googleMapsPlaceUrl(mapCoords)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon
                    name="map"
                    className="text-sm shrink-0 opacity-80 group-hover:opacity-100"
                    aria-hidden
                  />
                  Ver no Google Maps
                </a>
                <p className="mt-1 font-mono text-[10px] text-text-secondary/85">
                  {mapCoords.latitude.toFixed(6)}, {mapCoords.longitude.toFixed(6)}
                </p>
              </div>
            ) : null}
            {hasTicketBox ? (
              <div className="mt-4 rounded-xl bg-primary/8 dark:bg-primary/15 border border-primary/25 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary mb-1.5 flex items-center gap-1">
                  <Icon name="confirmation_number" className="text-sm" aria-hidden />
                  Onde comprar ingressos ou reservar
                </p>
                {ticket.hint ? (
                  <p className="text-xs text-text-secondary leading-relaxed">{ticket.hint}</p>
                ) : ticket.required && ticket.links.length === 0 ? (
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Verifique no site oficial do local ou plataforma de bilhetes da cidade para compra antecipada.
                  </p>
                ) : null}
                {ticket.links.length > 0 ? (
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {ticket.links.map(({ url: href, label }) => {
                      const line = label || `Ingresso ou reserva — ${linkHostname(href)}`
                      return (
                        <li key={href} className="min-w-0">
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1.5 text-xs font-semibold text-primary hover:underline group"
                          >
                            <Icon
                              name="open_in_new"
                              className="text-sm shrink-0 mt-0.5 opacity-70 group-hover:opacity-100"
                              aria-hidden
                            />
                            <span className="break-all">{line}</span>
                          </a>
                          <p className="text-[10px] text-text-secondary/85 font-mono break-all mt-0.5 ml-7 opacity-90">
                            {href}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}
