import React, { useState } from "preact/compat"
import { Fragment, h } from "preact"
import { TimeInput } from "../components/TimeInput"
import { Network } from "../App"
import { timelockEncrypt, roundAt, HttpChainClient } from "tlock-js"
import { quicknet } from "../actions/client-utils"
import { errorMessage } from "../actions/errors"

type FileEncryptProps = {
    network: Network
}

type ShareResult = {
    id: string
    originalName: string
}

export const FileEncrypt = (props: FileEncryptProps) => {
    const [file, setFile] = useState<File | null>(null)
    const [decryptionTime, setDecryptionTime] = useState(Date.now() + 24 * 60 * 60 * 1000)
    const [message, setMessage] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [processType, setProcessType] = useState<"share" | "download">("share")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [shareResult, setShareResult] = useState<ShareResult | null>(null)

    const onFileChange = (files: FileList) => {
        if (files.length > 0) {
            const f = files[0]
            if (f.size > 100 * 1024 * 1024) {
                setError("ファイルサイズが100MBを超えています。100MB以下のファイルを選択してください。")
                setFile(null)
                return
            }
            setFile(f)
            setError("")
            setSuccess("")
            setShareResult(null)
        }
    }

    const encryptFile = async (): Promise<string> => {
        if (!file) throw new Error("ファイルを選択してください")
        if (decryptionTime <= Date.now()) throw new Error("未来の日時を指定してください")

        const client = quicknet()
        const chainInfo = await client.chain().info()
        const roundNumber = roundAt(decryptionTime, chainInfo)

        const arrayBuffer = await file.arrayBuffer()
        const fileBuffer = Buffer.from(new Uint8Array(arrayBuffer))

        return await timelockEncrypt(roundNumber, fileBuffer, client)
    }

    const handleEncryptAndShare = async () => {
        if (!file) return setError("ファイルを選択してください")

        setIsProcessing(true)
        setProcessType("share")
        setError("")
        setSuccess("")
        setShareResult(null)

        try {
            // 1. Encrypt
            const ciphertext = await encryptFile()

            // 2. Create Blob & File for Upload
            const blob = new Blob([ciphertext], { type: "application/octet-stream" })
            const encryptedFile = new File([blob], `${file.name}.tlock`, { type: "application/octet-stream" })

            // 3. Upload
            const formData = new FormData()
            formData.append("file", encryptedFile)
            formData.append("originalName", file.name)
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
            setShareResult(result)
            setSuccess("✅ 暗号化して共有リンクを作成しました！")
            setFile(null)
            setMessage("")
        } catch (err: any) {
            console.error("Share error:", err)
            setError(err.message || errorMessage(err))
        } finally {
            setIsProcessing(false)
        }
    }

    const handleEncryptAndDownload = async () => {
        if (!file) return setError("ファイルを選択してください")

        setIsProcessing(true)
        setProcessType("download")
        setError("")
        setSuccess("")
        setShareResult(null)

        try {
            const ciphertext = await encryptFile()

            const blob = new Blob([ciphertext], { type: "application/octet-stream" })
            const anchor = document.createElement("a")
            anchor.href = URL.createObjectURL(blob)
            anchor.download = `${file.name}.tlock`
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            URL.revokeObjectURL(anchor.href)

            setSuccess(`✅ 暗号化完了！ 「${file.name}.tlock」をダウンロードしました`)
        } catch (err) {
            console.error("Encryption error:", err)
            setError(errorMessage(err))
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Fragment>
            <div className="row light-bg p-3">
                <div className="col-12">
                    <div className="vault-upload-section" style={{ position: "relative" }}>
                        {isProcessing && (
                            <div className="vault-processing-overlay">
                                <div className="vault-processing-content">
                                    <div className="spinner-border mb-3" role="status" style={{ width: "3em", height: "3em" }}></div>
                                    <h4>
                                        {processType === "share" ? "📤 暗号化してアップロード中..." : "🔒 暗号化しています..."}
                                    </h4>
                                    <p>
                                        {processType === "share"
                                            ? "暗号化とサーバーへの送信を行っています。\n完了すると共有リンクが発行されます。"
                                            : "ファイルサイズによっては数十秒かかることがあります。\nこのままお待ちください。"}
                                    </p>
                                </div>
                            </div>
                        )}

                        <h3 className="vault-section-title">
                            <span className="vault-icon">🔒</span> ファイルを作成 (暗号化)
                        </h3>
                        <p className="vault-description">
                            ファイルを選んで「いつ開けるか」を決めるだけで、指定時刻まで開けないタイムカプセルを作成できます。<br />
                            作成した暗号化ファイルは、そのまま共有リンクを発行するか、手元にダウンロードして保存できます。
                        </p>

                        <div className="row">
                            <div className="col-12 col-lg-6 mb-3">
                                <label className="form-label p-0">
                                    暗号化するファイル
                                    <input
                                        type="file"
                                        className="form-control"
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
                            <div className="col-12 col-lg-6 mb-3">
                                <TimeInput
                                    label={"解除予定日時"}
                                    value={decryptionTime}
                                    onChange={setDecryptionTime}
                                />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-12">
                                <label className="form-label p-0">
                                    メッセージ (共有時に表示・任意)
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={message}
                                        placeholder="例: サプライズの計画書です！当日まで内緒だよ 🤫"
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

                        {success && (
                            <div className="vault-success">
                                <p className="mb-0">{success}</p>
                            </div>
                        )}

                        {shareResult && (
                            <div className="vault-success mt-3">
                                <h5>🎉 共有リンクが作成されました！</h5>
                                <p>以下のURLをコピーして相手に送ってください：</p>
                                <div className="vault-share-url">
                                    <code id="share-url">{`${window.location.origin}#vault/${shareResult.id}`}</code>
                                    <button
                                        className="btn btn-sm btn-outline-light ms-2"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}#vault/${shareResult.id}`)
                                        }}
                                    >
                                        📋 コピー
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="row mt-4">
                            <div className="col-12 d-flex flex-column flex-md-row gap-2 justify-content-end">
                                <button
                                    className="btn btn-outline-secondary order-2 order-md-1"
                                    onClick={handleEncryptAndDownload}
                                    disabled={isProcessing || !file}
                                >
                                    💾 ファイルのみ保存 (ダウンロード)
                                </button>
                                <button
                                    className="btn btn-primary order-1 order-md-2"
                                    onClick={handleEncryptAndShare}
                                    disabled={isProcessing || !file}
                                    style={{ minWidth: "240px", fontWeight: "bold" }}
                                >
                                    📤 暗号化して共有リンクを作成
                                </button>
                            </div>
                        </div>
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
