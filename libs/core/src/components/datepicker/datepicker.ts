import { property, query, queryAll, queryAsync, state } from 'lit/decorators.js'
import { join } from 'lit/directives/join.js'
import { when } from 'lit/directives/when.js'
import { until } from 'lit/directives/until.js'
import { map } from 'lit/directives/map.js'
import { repeat } from 'lit/directives/repeat.js'
import { classMap } from 'lit/directives/class-map.js'
import { HTMLTemplateResult, nothing } from 'lit'
import { msg } from '@lit/localize'

import { GdsFormControlElement } from '../../components/form-control'
import {
  gdsCustomElement,
  html,
  getScopedTagName,
} from '../../utils/helpers/custom-element-scoping'
import { TransitionalStyles } from '../../utils/helpers/transitional-styles'
import { watch } from '../../utils/decorators'

import '../../primitives/popover/popover'

import '../../primitives/calendar/calendar'
import type { GdsCalendar } from '../../primitives/calendar/calendar'

import { GdsDropdown } from '../dropdown/dropdown'

import './date-part-spinner'
import type { GdsDatePartSpinner } from './date-part-spinner'

import { styles } from './datepicker.styles'
import { GdsPopover } from '../../primitives/popover/popover'

type DatePart = 'year' | 'month' | 'day'

type DateFormatLayout = {
  delimiter: string
  layout: { token: 'y' | 'm' | 'd'; name: DatePart }[]
}

const dateConverter = {
  fromAttribute(value: string) {
    return new Date(value)
  },
  toAttribute(value: Date) {
    return value.toISOString()
  },
}

/**
 * @element gds-datepicker
 * A form control that allows the user to select a date.
 *
 * @status beta
 *
 * @slot message - Message to show below the input field. Will be red if there is a validation error.
 * @slot sub-label - Renders between the label and the trigger button.
 * *
 * @event change - Fired when the value of the dropdown is changed through user interaction (not when value prop is set programatically).
 * @event gds-ui-state - Fired when the dropdown is opened or closed.
 */
@gdsCustomElement('gds-datepicker')
export class GdsDatepicker extends GdsFormControlElement<Date> {
  static styles = [styles]
  static shadowRootOptions: ShadowRootInit = {
    mode: 'open',
    delegatesFocus: true,
  }

  /**
   * The Date value of the datepicker. This can be set to undefined to clear the datepicker.
   * This can be a string if set via the value attribute in markup, or via the setAttribute DOM API.
   */
  @property({ converter: dateConverter })
  value?: Date

  /**
   * The minimum date that can be selected.
   */
  @property({ converter: dateConverter })
  min = new Date(new Date().getFullYear() - 10, 0, 1)

  /**
   * The maximum date that can be selected.
   */
  @property({ converter: dateConverter })
  max = new Date(new Date().getFullYear() + 10, 0, 1)

  /**
   * Controls wheter the datepicker popover is open.
   */
  @property({ type: Boolean })
  open = false

  /**
   * The label text displayed above the datepicker. This should always be set to a descriptive label.
   */
  @property()
  label = ''

  /**
   * Whether to show a column of week numbers in the calendar.
   */
  @property({ type: Boolean, attribute: 'show-week-numbers' })
  showWeekNumbers = false

  /**
   * Whether to use the small variant of the datepicker field.
   */
  @property()
  size: 'small' | 'medium' = 'medium'

  /**
   * Whether to hide the label above the input field.
   */
  @property({ type: Boolean, attribute: 'hide-label' })
  hideLabel = false

  /**
   * The date format to use. Accepts a string with the characters `y`, `m` and `d` in any order, separated by a delimiter.
   * For example, `y-m-d` or `d/m/y`. All three characters must be present.
   *
   * This will determine the structure of the input field.
   *
   * Defaults to `y-m-d`.
   */
  @property()
  get dateformat() {
    return this._dateFormatLayout.layout
      .map((f) => f.token)
      .join(this._dateFormatLayout.delimiter)
  }
  set dateformat(dateformat: string) {
    this._dateFormatLayout = this.#parseDateFormat(dateformat)
  }

  /**
   * Get the currently focused date in the calendar popover. If no date is focused, or the calendar popover
   * is closed, the value will be undefined.
   */
  async getFocusedDate(): Promise<Date | undefined> {
    if (this.open) return this._elCalendar.then((el) => el.focusedDate)
    else return undefined
  }

  /**
   * Get a string representation of the currently displayed value in the input field. The formatting will match the dateformat attribute.
   */
  get displayValue() {
    return this._elInput.innerText.replace(/\s+/g, '')
  }

  /**
   * A reference to the calendar button element inside the shadow root.
   * Inteded for use in integration tests.
   */
  @queryAsync('#calendar-button')
  test_calendarButton!: Promise<HTMLButtonElement>

  /**
   * A reference to a date cell element (<td>) inside the shadow root of the calendar primitive.
   * Inteded for use in integration tests.
   */
  async test_getDateCell(dayNumber: number) {
    return this._elCalendar.then((el) => el.getDateCell(dayNumber))
  }

  @state()
  private _focusedMonth = new Date().getMonth()

  @state()
  private _focusedYear = new Date().getFullYear()

  @state()
  private _dateFormatLayout = this.#parseDateFormat('y-m-d')

  @queryAsync('#calendar')
  private _elCalendar!: Promise<GdsCalendar>

  @queryAsync('#trigger')
  private _elTrigger!: Promise<HTMLButtonElement>

  @queryAll(getScopedTagName('gds-date-part-spinner'))
  private _elSpinners!: NodeListOf<GdsDatePartSpinner>

  @query('.input')
  private _elInput!: HTMLDivElement

  // Used for Transitional Styles in some legacy browsers
  @state()
  private _tStyles?: HTMLTemplateResult

  #valueOnOpen?: Date

  connectedCallback(): void {
    super.connectedCallback()
    TransitionalStyles.instance.apply(this, 'gds-datepicker')
  }

  render() {
    return html`${this._tStyles}
      ${when(
        this.label && !this.hideLabel,
        () => html`<label for="spinner-0" id="label">${this.label}</label>`
      )}

      <div class="form-info"><slot name="sub-label"></slot></div>

      <div
        class=${classMap({ field: true, small: this.size === 'small' })}
        id="trigger"
        @click=${this.#handleFieldClick}
        @copy=${this.#handleClipboardCopy}
        @paste=${this.#handleClipboardPaste}
      >
        <div
          class=${classMap({ input: true, 'is-placeholder': !this.value })}
          @focusout=${this.#handleFieldFocusOut}
        >
          ${join(
            map(
              this._dateFormatLayout.layout,
              (f, i) =>
                html`<gds-date-part-spinner
                  id="spinner-${i}"
                  .length=${f.token === 'y' ? 4 : 2}
                  .value=${this.#spinnerState[f.name]}
                  aria-valuemin=${this.#getMinSpinnerValue(f.name)}
                  aria-valuemax=${this.#getMaxSpinnerValue(f.name)}
                  aria-label=${this.#getSpinnerLabel(f.name)}
                  aria-describedby="label"
                  @keydown=${this.#handleSpinnerKeydown}
                  @change=${(e: CustomEvent) =>
                    this.#handleSpinnerChange(e.detail.value, f.name)}
                  @focus=${this.#handleSpinnerFocus}
                  @touchend=${(e: MouseEvent) => {
                    this.open = true
                    e.preventDefault()
                  }}
                ></gds-date-part-spinner>`
            ),
            html`<span>${this._dateFormatLayout.delimiter}</span>`
          )}
        </div>
        <button
          id="calendar-button"
          aria-label="${msg('Open calendar modal')}"
          aria-haspopup="menu"
          aria-expanded=${this.open}
          aria-controls="calendar-popover"
          aria-describedby="label"
          @click=${() => (this.open = !this.open)}
        >
          <svg viewBox="0 0 24 24" inert>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      <div class="form-info"><slot name="message"></slot></div>

      <gds-popover
        .triggerRef=${this._elTrigger}
        .open=${this.open}
        @gds-ui-state=${this.#handlePopoverStateChange}
        label=${this.label}
        id="calendar-popover"
        .placement=${'bottom-end'}
        .calcMinWidth=${() => (this.showWeekNumbers ? '350px' : '305px')}
        @focusin=${async (e: FocusEvent) => {
          const isPopover = (e.target as GdsPopover)?.id === 'calendar-popover'
          if (!isPopover) return
          this._elCalendar.then((cal) => cal.focus())
        }}
      >
        <div class="header">
          <button
            @click=${this.#handleDecrementFocusedMonth}
            aria-label=${msg('Previous month')}
          >
            <i class="icon prev"></i>
          </button>
          <gds-dropdown
            .value=${this._focusedMonth.toString()}
            @change=${this.#handleMonthChange}
            label="${msg('Month')}"
            style="width:120px"
            size="small"
            hide-label
          >
            <gds-option value="0">${msg('January')}</gds-option>
            <gds-option value="1">${msg('February')}</gds-option>
            <gds-option value="2">${msg('March')}</gds-option>
            <gds-option value="3">${msg('April')}</gds-option>
            <gds-option value="4">${msg('May')}</gds-option>
            <gds-option value="5">${msg('June')}</gds-option>
            <gds-option value="6">${msg('July')}</gds-option>
            <gds-option value="7">${msg('August')}</gds-option>
            <gds-option value="8">${msg('September')}</gds-option>
            <gds-option value="9">${msg('October')}</gds-option>
            <gds-option value="10">${msg('November')}</gds-option>
            <gds-option value="11">${msg('December')}</gds-option>
          </gds-dropdown>
          <gds-dropdown
            .value=${this._focusedYear.toString()}
            @change=${this.#handleYearChange}
            label="${msg('Year')}"
            size="small"
            hide-label
          >
            ${repeat(
              this.#years,
              (year) => year,
              (year) => html`<gds-option value=${year}>${year}</gds-option>`
            )}
          </gds-dropdown>
          <button
            @click=${this.#handleIncrementFocusedMonth}
            aria-label=${msg('Next month')}
          >
            <i class="icon next"></i>
          </button>
        </div>

        <gds-calendar
          id="calendar"
          @change=${this.#handleCalendarChange}
          @gds-date-focused=${this.#handleCalendarFocusChange}
          .focusedMonth=${this._focusedMonth}
          .focusedYear=${this._focusedYear}
          .value=${this.value}
          .min=${this.min}
          .max=${this.max}
          .showWeekNumbers=${this.showWeekNumbers}
        ></gds-calendar>

        <div class="footer">
          <button
            class="tertiary clear"
            @click=${() => {
              this.value = undefined
              this.#dispatchChangeEvent()
            }}
          >
            ${msg('Clear')}
          </button>
          ${until(this.#renderBackToValidRangeButton(), nothing)}
          <button
            class="tertiary today"
            @click=${() => {
              this.value = new Date()
              this.#dispatchChangeEvent()
            }}
          >
            ${msg('Today')}
          </button>
        </div>
      </gds-popover> `
  }

  async #renderBackToValidRangeButton() {
    const focusedDate = await this.getFocusedDate()

    let buttonTxt = ''
    let buttonAction: () => void

    if (focusedDate && focusedDate > this.max) {
      buttonTxt = msg('Last available date')
      buttonAction = () => this.#focusDate(this.max)
    } else if (focusedDate && focusedDate < this.min) {
      buttonTxt = msg('First available date')
      buttonAction = () => this.#focusDate(this.min)
    }

    return html`${when(
      buttonTxt.length > 0,
      () =>
        html`<button class="tertiary back-to-range" @click=${buttonAction}>
          ${buttonTxt}
        </button>`,
      () => nothing
    )}`
  }

  #focusDate(d: Date) {
    const firstValidDate = new Date(d)
    this._elCalendar
      .then((el) => (el.focusedDate = firstValidDate))
      .then(this.#handleCalendarFocusChange)
  }

  @watch('value')
  private _handleValueChange() {
    // Reset spinner state if value is unset
    if (!this.value) {
      this.#spinnerState = {
        year: 'yyyy',
        month: 'mm',
        day: 'dd',
      }
      return
    }

    const date = this.value
    this._focusedMonth = date.getMonth()
    this._focusedYear = date.getFullYear()

    // Update spinner state
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    this.#spinnerState = { year, month, day }
  }

  @watch('open')
  private _handleOpenChange() {
    if (this.open) {
      this.#valueOnOpen = this.value
      this._elCalendar.then((el) => el.focus())
    }
  }

  #getSpinnerLabel(name: DatePart) {
    const labels = {
      year: msg('Year'),
      month: msg('Month'),
      day: msg('Day'),
    }
    return labels[name]
  }

  #getMinSpinnerValue(name: DatePart) {
    const min = {
      year: 1900,
      month: 1,
      day: 1,
    }
    return min[name]
  }

  #getMaxSpinnerValue(name: DatePart) {
    const max = {
      year: 9999,
      month: 12,
      day: 31,
    }
    return max[name]
  }

  #dispatchChangeEvent() {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { value: this.value },
      })
    )
  }

  #dispatchInputEvent() {
    this.dispatchEvent(
      new CustomEvent('input', {
        detail: { value: this.value },
      })
    )
  }

  #handleFieldFocusOut = (e: FocusEvent) => {
    this._elTrigger.then((_) => {
      const parent = (e.relatedTarget as HTMLElement)?.parentElement
      if (parent === e.target) return
      document.getSelection()?.removeAllRanges()
    })
  }

  #handleSpinnerFocus = (e: FocusEvent) => {
    this._elTrigger.then((field) => {
      document.getSelection()?.removeAllRanges()
      const range = new Range()
      range.setStart(field.firstChild!, 0)
      range.setEnd(field.lastChild!, 4)
      document.getSelection()?.addRange(range)
    })
  }

  #handleClipboardCopy = (e: ClipboardEvent) => {
    this._elTrigger.then((field) => {
      if (e.currentTarget !== field) return
      e.preventDefault()
      e.clipboardData?.setData('text/plain', this.displayValue)
    })
  }

  #handleClipboardPaste = (e: ClipboardEvent) => {
    this._elTrigger.then((field: HTMLElement) => {
      if (e.currentTarget !== field) return
      e.preventDefault()
      const pasted = e.clipboardData?.getData('text/plain')
      if (!pasted) return

      const pastedDate = new Date(pasted)
      if (pastedDate.toString() === 'Invalid Date') return

      this.value = pastedDate
      this.#dispatchChangeEvent()
    })
  }

  #handleFieldClick = (e: MouseEvent) => {
    this._elSpinners[0].focus()
  }

  #handleCalendarChange = (e: CustomEvent<Date>) => {
    e.stopPropagation()
    this.value = e.detail
    this.open = false
    this.#dispatchChangeEvent()
  }

  #handleMonthChange = (e: CustomEvent) => {
    e.stopPropagation()
    this._focusedMonth = (e.target as GdsDropdown)?.value
  }

  #handleYearChange = (e: CustomEvent) => {
    e.stopPropagation()
    this._focusedYear = (e.target as GdsDropdown)?.value
  }

  #handleIncrementFocusedMonth = (_e: MouseEvent) => {
    this._focusedMonth++
    if (this._focusedMonth > 11) {
      this._focusedMonth = 0
      this._focusedYear++
    }
  }

  #handleDecrementFocusedMonth = (_e: MouseEvent) => {
    this._focusedMonth--
    if (this._focusedMonth < 0) {
      this._focusedMonth = 11
      this._focusedYear--
    }
  }

  #handleCalendarFocusChange = async () => {
    this._focusedMonth = (await this._elCalendar).focusedMonth
    this._focusedYear = (await this._elCalendar).focusedYear
    this.value = (await this._elCalendar).focusedDate
    this.requestUpdate()
    this.#dispatchInputEvent()
  }

  #handlePopoverStateChange = async (e: CustomEvent) => {
    if (e.target !== e.currentTarget) return
    this.open = e.detail.open

    if (e.detail.reason === 'close') {
      this.value = (await this._elCalendar).value
      this.#dispatchChangeEvent()
    }

    if (e.detail.reason === 'cancel') {
      this.value = this.#valueOnOpen
    }
  }

  #handleSpinnerKeydown = (e: KeyboardEvent) => {
    const index = Array.from(this._elSpinners).findIndex(
      (spinner) => spinner === e.target
    )
    if (e.key === 'ArrowRight') {
      const next = this._elSpinners[index + 1]
      if (next) next.focus()
    }
    if (e.key === 'ArrowLeft') {
      const prev = this._elSpinners[index - 1]
      if (prev) prev.focus()
    }
  }

  /**
   * Takes a dateformat string from the dateformat attribute and turnes it to a DateFormatLayout object used in rendering the template.
   */
  #parseDateFormat(dateformat: string): DateFormatLayout {
    const delimiter = dateformat.replace(/[a-z0-9]/gi, '')[0]
    const format = dateformat.split(delimiter)
    const year = format.findIndex((f) => f === 'y')
    const month = format.findIndex((f) => f === 'm')
    const day = format.findIndex((f) => f === 'd')

    if (year === -1 || month === -1 || day === -1)
      throw new Error('Invalid date format for <gds-datepicker>')

    const ordered = [year, month, day].sort((a, b) => a - b)
    const orderedFormat = ordered
      .map((i) => format[i])
      .map((f) => ({
        token: f,
        name: f === 'y' ? 'year' : f === 'm' ? 'month' : 'day',
      })) as DateFormatLayout['layout']

    return { delimiter, layout: orderedFormat }
  }

  #handleSpinnerChange = (val: string, name: DatePart) => {
    this.#spinnerState[name] = val

    const newDate = new Date()
    newDate.setFullYear(parseInt(this.#spinnerState.year))
    newDate.setMonth(parseInt(this.#spinnerState.month) - 1)
    newDate.setDate(parseInt(this.#spinnerState.day))

    if (newDate.toString() === 'Invalid Date') return

    this.value = newDate

    this.#dispatchChangeEvent()
  }

  /**
   * The spinner state keeps track of the spinner values regardless of wheter a complete date has been enter yet.
   */
  #spinnerState = {
    year: 'yyyy',
    month: 'mm',
    day: 'dd',
  }

  /**
   * Returns a year iterator between the min and max dates for use in the year dropdown.
   */
  get #years() {
    const minYear = this.min.getFullYear()
    const maxYear = this.max.getFullYear()
    const isOutsideRange = this.#isValueOutsideRange
    const valueYear = this.value?.getFullYear()
    return {
      *[Symbol.iterator]() {
        if (isOutsideRange) yield valueYear
        for (let i = minYear; i <= maxYear; i++) yield i
      },
    }
  }

  get #isValueOutsideRange() {
    if (!this.value) return false
    return (
      this.value.getFullYear() < this.min.getFullYear() ||
      this.value.getFullYear() > this.max.getFullYear()
    )
  }
}
