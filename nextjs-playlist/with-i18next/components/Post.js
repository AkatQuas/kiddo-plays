import React, { Component } from 'react';
import { translate } from 'react-i18next';

class Post extends Component {
    render () {
        const { t } = this.props;

        return (
            <div>
                {t('ns:great')}
            </div>
        )
    }
}

export default translate(['ns'])(Post)