import * as yup from "yup"

export const textEncryptionSchema = yup.object({
    plaintext: yup.string().nullable(true).optional().label("テキスト"),
    ciphertext: yup.string().nullable(true).optional().label("暗号文"),
    decryptionTime: yup.number()
        .positive()
        .required("解除時刻は必須です")
}).required()
