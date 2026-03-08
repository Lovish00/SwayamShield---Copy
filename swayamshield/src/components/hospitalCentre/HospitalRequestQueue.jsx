import AmbulanceRequestCard from './AmbulanceRequestCard';

export default function HospitalRequestQueue({ requests, onAccept, onReject, onDispatch, actionLoading }) {
  if (!requests || requests.length === 0) {
    return (
      <div className="card-base">
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
          No pending ambulance requests in queue.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {requests.map((request) => (
        <AmbulanceRequestCard
          key={request.request_id}
          request={request}
          onAccept={onAccept}
          onReject={onReject}
          onDispatch={onDispatch}
          actionLoading={actionLoading}
        />
      ))}
    </div>
  );
}
