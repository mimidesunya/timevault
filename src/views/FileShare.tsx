import { Fragment, h } from "preact"
import React, { useCallback, useState } from "preact/compat"
import { Network } from "../App"

type VaultEntry = {
    id: string
    originalName: string
    unlockTime: string
    message: string
    fileSize: number
    uploadedAt: string
    isUnlocked: boolean
}

type FileShareProps = {
    network: Network
}

export const FileShare = (props: FileShareProps) => {
    const [file, setFile] = useState<File | null>(null)
    const [message, setMessage] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [uploadResult, setUploadResult] = useState<VaultEntry | null>(null)
    const [error, setError] = useState("")

    const onFileChange = useCallback((files: FileList) => {
        if (files.length > 0) {
            const f = files[0]
            if (f.size > 100 * 1024 * 1024) {
                setError("ファイルサイズが100MBを超えています。100MB以下のファイルを選択してください。")
                setFile(null)
                return
            }
            setFile(f)
            setError("")
            setUploadResult(null)
        }
    }, [])

    const handleUpload = async () => {
        if (!file) {
            setError(".tlock ファイルを選択してください")
            return
        }

        setIsUploading(true)
        setError("")
        setUploadResult(null)

        try {
            // Remove .tlock extension for the original name
            let originalName = file.name
            if (originalName.endsWith(".tlock")) {
                originalName = originalName.slice(0, -6)
            }

            const formData = new FormData()
            formData.append("file", file)
            formData.append("originalName", originalName)
            formData.append("message", message)

            const res = await fetch("/api/vault/upload", {
                method: "POST",
                body: formData
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || "アップロードに失敗しました")
            }

            const result = await res.json()
            setUploadResult(result)
            setFile(null)
            setMessage("")

            // Reset file input
            const fileInput = document.getElementById("vault-file-input") as HTMLInputElement
            if (fileInput) fileInput.value = ""

        } catch (err: any) {
            console.error("Upload error:", err)
            setError(err.message || "アップロードに失敗しました")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Fragment>
            {/* Upload Section */}
            <div className="row light-bg p-3">
                <div className="col-12">
                    <div className="vault-upload-section" style={{ position: "relative" }}>
                        {isUploading && (
                            <div className="vault-processing-overlay">
                                <div className="vault-processing-content">
                                    <div className="spinner-border mb-3" role="status" style={{ width: "3em", height: "3em" }}></div>
                                    <h4>📤 アップロードしています...</h4>
                                    <p>ファイルをサーバーに送信中です。<br />このままお待ちください。</p>
                                </div>
                            </div>
                        )}

                        <h3 className="vault-section-title">
                            <span className="vault-icon">📤</span> 暗号化ファイルをアップロード
                        </h3>
                        <p className="vault-description">
                            手元にある .tlock ファイルをアップロードして共有リンクを発行します。<br />
                            通常は「ファイルを作る」画面から直接共有できますが、既にファイルをお持ちの場合はこちらからどうぞ。
                        </p>

                        <div className="row">
                            <div className="col-12 col-lg-6 mb-3">
                                <label className="form-label p-0">
                                    .tlock ファイルを選択
                                    <input
                                        id="vault-file-input"
                                        type="file"
                                        className="form-control"
                                        accept=".tlock"
                                        onChange={e => {
                                            const input = e.currentTarget as HTMLInputElement
                                            if (input.files) onFileChange(input.files)
                                        }}
                                    />
                                </label>
                                {file && (
                                    <p className="vault-file-info">
                                        📄 {file.name} ({formatFileSize(file.size)})
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-12">
                                <label className="form-label p-0">
                                    メッセージ (任意)
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={message}
                                        placeholder="例: 来週の発表資料です！お楽しみに 🎉"
                                        onChange={e => setMessage(e.currentTarget.value)}
                                    />
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="vault-error">
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="row">
                            <div className="col-12 text-end">
                                <button
                                    className="btn btn-primary vault-upload-btn"
                                    onClick={handleUpload}
                                    disabled={isUploading || !file}
                                >
                                    📤 アップロード
                                </button>
                            </div>
                        </div>

                        {uploadResult && (
                            <div className="vault-success">
                                <h5>✅ アップロード完了！</h5>
                                <p>共有URLをコピーして相手に送ってください：</p>
                                <div className="vault-share-url">
                                    <code id="share-url">{`${window.location.origin}#vault/${uploadResult.id}`}</code>
                                    <button
                                        className="btn btn-sm btn-outline-light ms-2"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}#vault/${uploadResult.id}`)
                                        }}
                                    >
                                        📋 コピー
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Fragment>
    )
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
