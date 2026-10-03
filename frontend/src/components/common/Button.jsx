export function Button({
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  icon = null,
  ...props
}) {
  const variantClass = {
    primary: 'btn-primary',
    white: 'btn-white',
    outlineDark: 'btn-outline-dark',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
  }[variant] || 'btn-primary';

  return (
    <button
      className={`${variantClass} ${className}`}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span>Đang xử lý...</span>
        </span>
      ) : (
        <>
          {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
