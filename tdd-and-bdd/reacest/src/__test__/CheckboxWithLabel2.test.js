import React from 'react';
import CheckboxWithLabel from '../CheckboxWithLabel';
import { shallow, configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

describe('CheckboxWithLabel in enzyme', () => {
    it('CheckboxWithLabel changes the text after click', () => {
        const labelOff = 'lOff';
        const labelOn = 'lOn';
        const checkbox = shallow(<CheckboxWithLabel labelOn={labelOn} labelOff={labelOff} />);
        expect(checkbox.text()).toEqual(labelOff);

        checkbox.find('input').simulate('change');
        expect(checkbox.text()).toEqual(labelOn);
    });
});

