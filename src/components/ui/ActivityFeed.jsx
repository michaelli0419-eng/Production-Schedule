import { useMemo } from 'react';

const TYPE_ICONS = {
  call: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 2h2.3l1 2.5-1.35 1.35a8.5 8.5 0 003.7 3.7L9.5 8.2l2.5 1v2.3A1.5 1.5 0 0110.5 13C5.25 13 1 8.75 1 3.5A1.5 1.5 0 012.5 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  email: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  meeting: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 1.5v2M9.5 1.5v2M1.5 6h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  note: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 1.5h8a1 1 0 011 1v8l-3 2H3a1 1 0 01-1-1v-9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  task: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 7l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const TYPE_COLORS = {
  call: 'ui-activity__icon--call',
  email: 'ui-activity__icon--email',
  meeting: 'ui-activity__icon--meeting',
  note: 'ui-activity__icon--note',
  task: 'ui-activity__icon--task',
};

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name) {
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function SkeletonItem() {
  return (
    <li className="ui-activity__item ui-activity__item--skeleton">
      <div className="ui-activity__icon-wrap ui-activity__icon--skeleton" />
      <div className="ui-activity__content">
        <div className="ui-activity__shimmer ui-activity__shimmer--title" />
        <div className="ui-activity__shimmer ui-activity__shimmer--meta" />
      </div>
    </li>
  );
}

export default function ActivityFeed({
  activities = [],
  loading = false,
  emptyText = 'No activity yet.',
  onLoadMore,
  hasMore = false,
}) {
  return (
    <div className="ui-activity-feed">
      {loading && activities.length === 0 ? (
        <ul className="ui-activity__list">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)}
        </ul>
      ) : activities.length === 0 ? (
        <div className="ui-activity__empty">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M16 10v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>{emptyText}</span>
        </div>
      ) : (
        <ul className="ui-activity__list">
          {activities.map((activity, index) => (
            <li
              key={activity.id ?? index}
              className={`ui-activity__item ${index === activities.length - 1 ? 'ui-activity__item--last' : ''}`}
            >
              <div className="ui-activity__timeline-col">
                <div className={`ui-activity__icon-wrap ${TYPE_COLORS[activity.type] || 'ui-activity__icon--note'}`}>
                  {TYPE_ICONS[activity.type] || TYPE_ICONS.note}
                </div>
                {index < activities.length - 1 && <div className="ui-activity__connector" />}
              </div>
              <div className="ui-activity__content">
                <div className="ui-activity__row">
                  {activity.user && (
                    <span
                      className="ui-activity__avatar"
                      style={{ backgroundColor: avatarColor(activity.user) }}
                      title={activity.user}
                    >
                      {initials(activity.user)}
                    </span>
                  )}
                  <span className="ui-activity__message">{activity.message}</span>
                </div>
                <div className="ui-activity__meta">
                  {activity.user && <span className="ui-activity__user">{activity.user}</span>}
                  {activity.user && activity.createdAt && <span className="ui-activity__sep">·</span>}
                  {activity.createdAt && (
                    <time className="ui-activity__time" dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()}>
                      {timeAgo(activity.createdAt)}
                    </time>
                  )}
                </div>
              </div>
            </li>
          ))}
          {loading && <SkeletonItem />}
        </ul>
      )}
      {hasMore && !loading && (
        <button className="ui-activity__load-more" onClick={onLoadMore}>
          Load more
        </button>
      )}
    </div>
  );
}
