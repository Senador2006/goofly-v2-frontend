export function Icon({ name, className = '', filled = false, ...props }) {
  return (
    <span
      className={`material-icons-outlined ${className}`}
      style={{
        fontSize: 'inherit',
        userSelect: 'none',
        ...(filled && { fontVariationSettings: "'FILL' 1" }),
      }}
      {...props}
    >
      {name}
    </span>
  )
}
