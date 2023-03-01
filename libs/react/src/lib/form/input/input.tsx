import React, { InputHTMLAttributes } from 'react'
import { IValidator, IndicatorType, validateClassName } from '@sebgroup/extract'
import {
  CheckboxProps,
  NumberInputProps,
  RadioButtonProps,
  TextInputProps,
} from '../types'
import { FormItem } from '../../formItem'
import useInput from '../useInput'

export type Renderer = (
  type: string,
  props: InputHTMLAttributes<HTMLInputElement>,
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void,
  onChangeInput?: (value: string) => string,
  label?: string,
  info?: string,
  validator?: IValidator,
  expandableInfo?: string,
  expandableInfoButtonLabel?: string
) => JSX.Element

export const RenderInput: Renderer = (
  type,
  props,
  onChange,
  onChangeInput,
  label,
  info,
  validator,
  expandableInfo,
  expandableInfoButtonLabel
) => {
  const { value, ...inputProps } = useInput(props, onChange, onChangeInput)

  const propsWithDescription = info
    ? { ...inputProps, 'aria-describedby': `${inputProps.id}_info` }
    : inputProps

  // Render naked
  if (!label && !info && !expandableInfo)
    return <input type={type} value={value} {...propsWithDescription} />

  return (
    <FormItem
      validator={validator}
      labelInformation={info}
      label={label}
      expandableInfo={expandableInfo}
      expandableInfoButtonLabel={expandableInfoButtonLabel}
      inputId={inputProps.id}
    >
      <input
        type={type}
        value={value}
        {...propsWithDescription}
        className={
          validator && validateClassName(validator?.indicator as IndicatorType)
        }
      />
    </FormItem>
  )
}

export const TextInput = ({
  label,
  info,
  onChange,
  onChangeInput,
  validator,
  expandableInfo,
  expandableInfoButtonLabel,
  ...props
}: TextInputProps) =>
  RenderInput(
    'text',
    props,
    onChange,
    onChangeInput,
    label,
    info,
    validator,
    expandableInfo,
    expandableInfoButtonLabel
  )

export const EmailInput = ({
  label,
  info,
  onChange,
  onChangeInput,
  validator,
  ...props
}: TextInputProps) =>
  RenderInput('email', props, onChange, onChangeInput, label, info, validator)

export const NumberInput = ({
  label,
  info,
  onChange,
  onChangeInput,
  validator,
  expandableInfo,
  expandableInfoButtonLabel,
  ...props
}: NumberInputProps) =>
  RenderInput(
    'number',
    props,
    onChange,
    onChangeInput,
    label,
    info,
    validator,
    expandableInfo,
    expandableInfoButtonLabel
  )

export const Checkbox = ({
  label,
  onChange,
  validator,
  ...props
}: CheckboxProps) => {
  const inputProps = useInput(props, onChange)
  const validatorClassName: string = validateClassName(
    validator?.indicator as IndicatorType
  )

  return (
    <div className="form-group">
      <label
        htmlFor={inputProps.id}
        className={`form-control ${validatorClassName}`}
      >
        {label}
        <input type="checkbox" {...inputProps} className={validatorClassName} />
        <i />
      </label>
      {validator && <span className="form-info">{validator.message}</span>}
    </div>
  )
}

export const RadioButton = React.forwardRef(
  (
    { label, validator, ...props }: RadioButtonProps,
    ref: React.ForwardedRef<HTMLInputElement>
  ) => {
    const { id } = useInput(props)

    return (
      <label htmlFor={id} className="form-control">
        <input
          id={id}
          type="radio"
          {...props}
          className={validator}
          ref={ref}
        />
        <span>{label}</span>
        <i />
      </label>
    )
  }
)
