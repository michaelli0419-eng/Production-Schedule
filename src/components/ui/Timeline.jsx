const STATUS_CLASSES = {
  done: 'ui-timeline__dot--done',
  active: 'ui-timeline__dot--active',
  pending: 'ui-timeline__dot--pending',
};

const STATUS_LABELS = {
  done: 'Completed',
  active: 'In progress',
  pending: 'Pending',
};

function DoneCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ActivePulse() {
  return <span className="ui-timeline__pulse" />;
}

export default function Timeline({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="ui-timeline ui-timeline--empty">
        <span>No milestones defined.</span>
      </div>
    );
  }

  return (
    <ol className="ui-timeline">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const status = item.status || 'pending';

        return (
          <li key={item.id ?? index} className={`ui-timeline__item ${isLast ? 'ui-timeline__item--last' : ''}`}>
            <div className="ui-timeline__track">
              <div
                className={`ui-timeline__dot ${STATUS_CLASSES[status] || STATUS_CLASSES.pending}`}
                aria-label={STATUS_LABELS[status]}
                title={STATUS_LABELS[status]}
              >
                {status === 'done' && <DoneCheck />}
                {status === 'active' && <ActivePulse />}
              </div>
              {!isLast && (
                <div className={`ui-timeline__line ${status === 'done' ? 'ui-timeline__line--done' : 'ui-timeline__line--pending'}`} />
              )}
            </div>
            <div className="ui-timeline__content">
              <div className="ui-timeline__header">
                <span className={`ui-timeline__label ${status === 'active' ? 'ui-timeline__label--active' : ''}`}>
                  {item.label}
                </span>
                {item.date && (
                  <time className="ui-timeline__date" dateTime={item.date}>
                    {new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                )}
              </div>
              {item.description && (
                <p className="ui-timeline__description">{item.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
