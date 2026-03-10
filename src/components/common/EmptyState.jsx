import { Icon } from './Icon'

export function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="size-16 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center mb-4">
        <Icon name={icon} className="text-4xl text-text-secondary" />
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      {description && <p className="text-text-secondary text-sm mb-6 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
