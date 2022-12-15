import { Button, Form, Input, Modal } from 'antd';

export default ({ open, node, onCancel, onConfirm }) => {
  return (
    <Modal
      open={open}
      title="Shared memory With Form"
      footer={null}
      onCancel={onCancel}
      style={{
        left: '5%',
        margin: '0',
      }}
    >
      <Form initialValues={node} onFinish={onConfirm}>
        <Form.Item label="Name" name="name">
          <Input />
        </Form.Item>

        <Form.Item label="IP" name="ip">
          <Input />
        </Form.Item>
        <Form.Item>
          <Button htmlType="button" onClick={onCancel}>
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
};
