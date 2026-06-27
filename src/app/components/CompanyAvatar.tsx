interface CompanyAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const gradients = [
  'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #6366f1 100%)',
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export function CompanyAvatar({ name, size = 'md' }: CompanyAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-[13px]',
    md: 'w-11 h-11 text-[15px]',
    lg: 'w-14 h-14 text-[18px]',
  };

  const initial = name.charAt(0).toUpperCase();
  const gradient = getGradient(name);

  return (
    <div
      className={`${sizeClasses[size]} rounded-xl flex items-center justify-center font-semibold text-white flex-shrink-0 shadow-sm`}
      style={{ background: gradient }}
    >
      {initial}
    </div>
  );
}
