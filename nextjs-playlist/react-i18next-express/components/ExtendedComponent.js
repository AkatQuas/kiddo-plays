import React from 'react'
import { translate } from 'react-i18next'

const MyComponent = ({ t }) => (
    <p>{t('extendedComponent')}</p>
)

const Extended = translate('common')(MyComponent)

export default Extended