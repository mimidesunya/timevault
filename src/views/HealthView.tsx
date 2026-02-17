import { h, Fragment } from "preact"
import { useEffect, useState } from "preact/compat"

type HealthCheck = {
    status: string
    timestamp: number
    checks: Record<string, any>
}

export const HealthView = () => {
    const [health, setHealth] = useState<HealthCheck | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const response = await fetch('/api/health')
                if (response.ok) {
                    const data = await response.json()
                    setHealth(data)
                }
            } catch (error) {
                console.error("Failed to fetch health status", error)
            } finally {
                setLoading(false)
            }
        }
        fetchHealth()
    }, [])

    if (loading) return <div className="p-3">Checking system status...</div>
    if (!health) return <div className="p-3 text-danger">System status unavailable.</div>

    return (
        <div className="p-3">
            <h3>System Status</h3>
            <p className="text-muted small">Last updated: {new Date(health.timestamp * 1000).toLocaleString()}</p>
            
            <div className="card mb-3">
                <div className="card-header">
                    Overall Status: <span className={`badge ${health.status === 'ok' ? 'bg-success' : 'bg-danger'}`}>{health.status.toUpperCase()}</span>
                </div>
                <div className="card-body">
                    <div className="row">
                        {Object.entries(health.checks).map(([key, value]) => (
                            <div key={key} className="col-12 col-md-6 mb-3">
                                <div className="card h-100">
                                    <div className="card-body">
                                        <h5 className="card-title text-capitalize">{key.replace(/_/g, ' ')}</h5>
                                        <h6 className="card-subtitle mb-2 text-muted">
                                            Status: <span className={value.status === 'ok' ? 'text-success' : 'text-danger'}>{value.status}</span>
                                        </h6>
                                        <ul className="list-unstyled mb-0">
                                            {Object.entries(value).map(([k, v]) => {
                                                if (k === 'status') return null
                                                return (
                                                    <li key={k} className="small">
                                                        <strong>{k.replace(/_/g, ' ')}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
