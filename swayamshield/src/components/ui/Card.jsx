export default function Card({ children, className = '', hover = true, ...props }) {
  return (
    <div
      className={`card-base ${hover ? 'hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
