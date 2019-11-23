'use strict';

module.exports = app => {
    const { STRING, INTEGER, DATE, NOW, UUIDV4 } = app.Sequelize;
    const Model = app.model.define('', {
        soft_delete: {
            type: INTEGER,
            defaultValue: 0,
        },
        create_time: {
            type: DATE,
            defaultValue: NOW,
        },
        update_time: {
            type: DATE,
            defaultValue: NOW,
        },
        create_guid: {
            type: STRING(36),
            defaultValue: UUIDV4,
        }
    }, {
            freezeTableName: true,
            timestamps: false
        }
    );
    return Model;
}