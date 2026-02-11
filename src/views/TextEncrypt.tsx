import React, { useEffect, useMemo, useState } from "preact/compat"
import { Fragment, h } from "preact"
import { CompletedWebForm, encryptedOrDecryptedFormData } from "../actions/encrypt-text"
import { createDebouncer } from "../actions/debounce"
import { TextArea } from "../components/TextArea"
import { TimeInput } from "../components/TimeInput"
import { FileInput } from "../components/FileInput"
import { errorMessage } from "../actions/errors"
import { Network } from "../App"

type TextEncryptProps = {
    network: Network
}
const TextEncrypt = (props: TextEncryptProps) => {
    const [plaintext, setPlaintext] = useState("")
    const [ciphertext, setCiphertext] = useState("")
    const [decryptionTime, setDecryptionTime] = useState(Date.now())
    const [error, setError] = useState("")
    const debounced = useMemo(() => createDebouncer<CompletedWebForm>(), [])

    useEffect(() => {
        if (!plaintext) {
            return
        }

        debounced(() => encryptedOrDecryptedFormData(props.network, { plaintext, ciphertext, decryptionTime }))
            .then(output => {
                setCiphertext(output.ciphertext ?? "")
                setDecryptionTime(output.decryptionTime)
            })
            .catch(err => {
                console.error(err)
                setError(errorMessage(err))
            })
    }, [plaintext, decryptionTime, props.network])

    const onFileChange = (files: FileList) => {
        if (files.length === 0) return
        const file = files[0]
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result
            if (typeof text === "string") {
                setPlaintext(text)
            }
        }
        reader.readAsText(file)
    }

    return (
        <Fragment>
            <div className="row p-0" id="errors">
                <p className="m-0 p-0" id="error">{error}</p>
            </div>
            <div className={"col-sm-6 p-3"}>
                <div className="row mb-6">
                    <TimeInput
                        label={"解除予定日時"}
                        value={decryptionTime}
                        onChange={setDecryptionTime}
                    />
                </div>
            </div>

            <div class="row light-bg p-0">
                <div class="col-12 col-lg-6 p-3">
                    <div className="row mb-6">
                        <div className="mb-3">
                            <FileInput
                                label={"ファイルから読み込み (オプション)"}
                                onChange={onFileChange}
                            />
                        </div>
                        <TextArea
                            label={"内容 (暗号化したいテキスト)"}
                            value={plaintext}
                            onChange={setPlaintext}
                        />
                    </div>
                </div>
                <div class="col-12 col-lg-6 p-3">
                    <div className="row mb-6">
                        <TextArea
                            label={"暗号文 (結果)"}
                            value={ciphertext}
                            onChange={setCiphertext}
                        />
                    </div>
                </div>
            </div>
        </Fragment>
    )
}

export { TextEncrypt }
