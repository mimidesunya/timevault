import { h, Fragment } from "preact"
import React, { useEffect, useState } from "preact/compat"

export type VaultEntry = {
    id: string
    originalName: string
    unlockTime: string
    message: string
    fileSize: number
    uploadedAt: string
    isUnlocked: boolean
}

export const VaultList = () => {
    const [vaultList, setVaultList] = useState<VaultEntry[]>([])
    const [isLoadingList, setIsLoadingList] = useState(true)

    // Load vault list on mount and periodically
    useEffect(() => {
        loadVaultList()
        const interval = setInterval(loadVaultList, 60000) // Refresh every minute
        return () => clearInterval(interval)
    }, [])

    const loadVaultList = async () => {
        try {
            const res = await fetch("/api/vault/list")
            if (res.ok) {
                const data = await res.json()
                setVaultList(data)
            }
        } catch (err) {
            console.error("Failed to load vault list:", err)
        } finally {
            setIsLoadingList(false)
        }
    }

    return (
        <div className="row mb-5 vault-list-section">
            <div className="col-12">
                <h3 className="vault-section-title mb-4">
                    <span className="vault-icon">📦</span> 公開されている時限暗号
                </h3>

                {isLoadingList ? (
                    <div className="text-center p-4">
                        <div className="spinner-border text-primary" role="status"></div>
                    </div>
                ) : vaultList.length === 0 ? (
                    <div className="text-center p-5 light-bg rounded-3">
                        <p className="text-muted mb-0">まだ共有されたファイルはありません。<br />あなたが最初の時限爆弾を投下しましょう！💣</p>
                    </div>
                ) : (
                    <div className="vault-list">
                        {vaultList.map(entry => (
                            <VaultListItem key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

type VaultListItemProps = {
    entry: VaultEntry
}

const VaultListItem = (props: VaultListItemProps) => {
    const { entry } = props
    const unlockDate = new Date(entry.unlockTime)
    const now = new Date()
    const isUnlocked = now >= unlockDate
    const timeRemaining = getTimeRemaining(unlockDate)

    const handleDownload = async () => {
        try {
            const res = await fetch(`/api/vault/download/${entry.id}`)
            if (!res.ok) {
                const errData = await res.json()
                alert(errData.error || "ダウンロードに失敗しました")
                return
            }

            const blob = await res.blob()
            const anchor = document.createElement("a")
            anchor.href = URL.createObjectURL(blob)
            anchor.download = `${entry.originalName}.tlock`
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            URL.revokeObjectURL(anchor.href)
        } catch (err) {
            console.error("Download error:", err)
            alert("ダウンロードに失敗しました")
        }
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}#vault/${entry.id}`)
        alert("リンクをコピーしました！")
    }

    return (
        <div className={`vault-item ${isUnlocked ? "vault-item-unlocked" : "vault-item-locked"}`}>
            <div className="vault-item-header">
                <div className="vault-item-status">
                    {isUnlocked ? (
                        <span className="vault-badge vault-badge-unlocked">🔓 解除済・消滅</span>
                    ) : (
                        <span className="vault-badge vault-badge-locked">🔒 ロック中</span>
                    )}
                </div>
                <div className="vault-item-time">
                    {isUnlocked ? (
                        <div className="text-muted">
                            <span className="vault-item-time-label">解除日時</span>
                            {unlockDate.toLocaleString()}
                        </div>
                    ) : (
                        <div style={{ color: "#e8756d" }}>
                            <span className="vault-item-time-label">⏰ 消滅まで残り</span>
                            {timeRemaining}
                        </div>
                    )}
                </div>
            </div>

            <div className="vault-item-body">
                <div className="vault-item-name">
                    📄 {entry.originalName}
                    <span className="vault-item-size">{formatFileSize(entry.fileSize)}</span>
                </div>
                {entry.message && (
                    <div className="vault-item-message">
                        💬 {entry.message}
                    </div>
                )}
            </div>

            <div className="vault-item-actions mt-3">
                {!isUnlocked ? (
                    <div className="d-grid gap-2 d-md-block w-100">
                        <button className="btn btn-primary w-100 mb-2 mb-md-0 me-md-2 py-2 fw-bold" onClick={handleDownload} style={{ fontSize: "1.1em" }}>
                            ⬇️ 今すぐ確保 (ダウンロード)
                        </button>
                        <button className="btn btn-outline-secondary w-100 w-md-auto py-2" onClick={handleCopyLink}>
                            📋 共有リンクをコピー
                        </button>
                        <div className="text-center mt-2">
                            <small className="text-muted">※ 解除時刻を過ぎるとサーバーから消滅します</small>
                        </div>
                    </div>
                ) : (
                    <div className="w-100 text-center p-2" style={{ background: "rgba(0,0,0,0.05)", borderRadius: "8px" }}>
                        <span className="vault-expired-text fw-bold">
                            🚫 解除時刻を過ぎたため、ファイルは消滅しました
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTimeRemaining(unlockDate: Date): string {
    const now = new Date()
    const diff = unlockDate.getTime() - now.getTime()
    if (diff <= 0) return "0秒"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    const parts: string[] = []
    if (days > 0) parts.push(`${days}日`)
    if (hours > 0) parts.push(`${hours}時間`)
    if (minutes > 0) parts.push(`${minutes}分`)

    return parts.join("") || "まもなく"
}
