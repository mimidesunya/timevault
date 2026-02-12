import React, { useState } from "preact/compat"
import { Fragment, h } from "preact"
import { Network } from "../App"
import { timelockDecrypt } from "tlock-js"
import { quicknet } from "../actions/client-utils"
import { localisedDecryptionMessageOrDefault } from "../actions/errors"

type FileDecryptProps = {
    network: Network
}

export const FileDecrypt = (props: FileDecryptProps) => {
    const [file, setFile] = useState<File | null>(null)
    const [isDecrypting, setIsDecrypting] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const onFileChange = (files: FileList) => {
        if (files.length > 0) {
            setFile(files[0])
            setError("")
            setSuccess("")
        }
    }

    const handleDecrypt = async () => {
        if (!file) {
            setError(".tlock ファイルを選択してください")
            return
        }

        setIsDecrypting(true)
        setError("")
        setSuccess("")

        try {
            const client = quicknet()

            // Read file as text (tlock ciphertext is text)
            const ciphertext = await file.text()

            // Decrypt
            const plainBuffer = await timelockDecrypt(ciphertext, client)

            // Determine original filename (remove .tlock extension if present)
            let originalName = file.name
            if (originalName.endsWith(".tlock")) {
                originalName = originalName.slice(0, -6)
            } else {
                originalName = `decrypted_${originalName}`
            }

            // Download decrypted file
            const blob = new Blob([new Uint8Array(plainBuffer)], { type: "application/octet-stream" })
            const anchor = document.createElement("a")
            anchor.href = URL.createObjectURL(blob)
            anchor.download = originalName
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            URL.revokeObjectURL(anchor.href)

            setSuccess(`✅ 復号完了！ 「${originalName}」をダウンロードしました`)
        } catch (err) {
            console.error("Decryption error:", err)
            setError(localisedDecryptionMessageOrDefault(err))
        } finally {
            setIsDecrypting(false)
        }
    }

    return (
        <Fragment>
            <div className="row light-bg p-3">
                <div className="col-12">
                    <div className="vault-upload-section" style={{ position: "relative" }}>
                        {isDecrypting && (
                            <div className="vault-processing-overlay">
                                <div className="vault-processing-content">
                                    <div className="spinner-border mb-3" role="status" style={{ width: "3em", height: "3em" }}></div>
                                    <h4>🔓 復号しています...</h4>
                                    <p>解除時刻の確認とファイルの復号を行っています。<br />このままお待ちください。</p>
                                </div>
                            </div>
                        )}

                        <h3 className="vault-section-title">
                            <span className="vault-icon">🔓</span> ファイルを復号
                        </h3>
                        <p className="vault-description">
                            暗号化された .tlock ファイルを選択すると、解除時刻を過ぎていれば元のファイルに復号してダウンロードします。<br />
                            復号もブラウザ内で完結し、サーバーにデータは送信されません。
                        </p>

                        <div className="row">
                            <div className="col-12 col-lg-6 mb-3">
                                <label className="form-label p-0">
                                    .tlock ファイルを選択
                                    <input
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

                        <div className="row mt-2">
                            <div className="col-12 text-end">
                                <button
                                    className="btn btn-primary vault-upload-btn"
                                    onClick={handleDecrypt}
                                    disabled={isDecrypting || !file}
                                >
                                    🔓 復号してダウンロード
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
