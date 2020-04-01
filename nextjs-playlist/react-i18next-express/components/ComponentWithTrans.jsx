import React from 'react';
import { Trans } from "react-i18next";

export default _ => (
    <p>
        <Trans i18nKey="common:transComponent" />
        <p>
            Trans need `t` and in its parent component
        </p>
    </p>
)