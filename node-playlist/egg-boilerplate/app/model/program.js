'use strict';

module.exports = app => {
    const { STRING, INTEGER, DATE, NOW } = app.Sequelize;
    const Model = app.model.define('program', {
        type: {
            type: INTEGER,
            allowNull: false
        },
        name: {
            type: STRING,
            allowNull: false
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