interface StepperProps {
  currentStep: number // 1-based
  steps: string[]
}

export default function Stepper({ currentStep, steps }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        return (
          <>
            <div className="stepper__step" key={label}>
              <div
                className={`stepper__circle${isDone ? ' stepper__circle--done' : ''}${isActive ? ' stepper__circle--active' : ''}`}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span className={`stepper__label${isActive ? ' stepper__label--active' : ''}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && <div className="stepper__line" key={`line-${idx}`} />}
          </>
        )
      })}
    </div>
  )
}
