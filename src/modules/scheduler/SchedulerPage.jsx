import ProductionScheduler from '../../components/ProductionScheduler.jsx';

export default function SchedulerPage({ currentUser, permissions, onLogout }) {
  return (
    <ProductionScheduler
      currentUser={currentUser}
      permissions={permissions}
      onLogout={onLogout}
    />
  );
}
