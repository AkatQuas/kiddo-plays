import 'isomorphic-unfetch';

export async function getAllTranslations(langs, nses, baseUrl) {
    const all = {}

    for (let lang of langs) {
        const temp = {}

        for (let ns of nses) {

            const res = await fetch(`${baseUrl}${lang}/${ns}.json`)
            temp[ns] = await res.json()

        }
        all[lang] = temp

    }

    return all
}