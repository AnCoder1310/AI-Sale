export function Badge({ children, variant = 'default', className = '', ...props }) {
  const variantClass = {
    default: 'badge',
    dark: 'badge badge-dark',
    highlight: 'badge badge-highlight',
    success: 'badge',
  }[variant] || 'badge';

  return (
    <span className={`${variantClass} ${className}`} {...props}>
      {children}
    </span>
  );
}
