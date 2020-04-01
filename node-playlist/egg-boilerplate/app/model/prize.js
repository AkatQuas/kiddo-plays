'use strict';

module.exports = app => {
    const { STRING, INTEGER, DATE, NOW, UUIDV4 } = app.Sequelize;
    const Model = app.model.define('prize', {
        create_guid: {
            type: STRING(36),
            defaultValue: UUIDV4,
        },
        name: {
            type: STRING,
            allowNull: false,
        },
        amount: {
            type: INTEGER,
            allowNull: false,
        },
        type: {
            type: INTEGER,
            allowNull: false,
        },
        note: {
            type: STRING
        },
        create_time: {
            type: DATE,
            defaultValue: NOW,
        },
        update_time: {
            type: DATE,
            defaultValue: NOW,
        },
    }, {
            freezeTableName: true,
            timestamps: false
        }
    );
    return Model;
}