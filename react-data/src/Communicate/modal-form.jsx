import { Button, Form, Input, Modal } from 'antd';
import React from 'react';

class ModalForm extends React.Component {
  state = {
    open: false,
  };
  formRef = React.createRef();

  openModal = (node) => {
    this.setState(
      {
        open: true,
      },
      () => {
        this.formRef.current.setFieldsValue({
          name: node.name,
          ip: node.ip,
        });
      }
    );
  };

  closeModal = () => {
    this.setState({
      open: false,
    });
  };

  formFinish = (payload) => {
    /* optional formation */
    const { onConfirm } = this.props;
    if (onConfirm) {
      onConfirm(payload).then(this.closeModal);
    }
  };

  render() {
    const { open } = this.state;
    return (
      <Modal
        open={open}
        onCancel={this.closeModal}
        title="Modal Form on Shared"
        footer={null}
        style={{
          left: '40%',
          margin: '0',
        }}
      >
        <Form ref={this.formRef} onFinish={this.formFinish}>
          <Form.Item label="Name" name="name">
            <Input />
          </Form.Item>

          <Form.Item label="IP" name="ip">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button htmlType="button" onClick={this.closeModal}>
              Cancel
            </Button>
            &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    );
  }
}

export default ModalForm;
