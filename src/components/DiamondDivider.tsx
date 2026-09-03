interface DiamondDividerProps {
  className?: string
}

export default function DiamondDivider({ className = '' }: DiamondDividerProps) {
  return (
    <div className={`divider ${className}`}>
      <span className="divider__diamond">◇</span>
    </div>
  )
}
