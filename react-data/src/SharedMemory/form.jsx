import { Input, Modal, Typography } from 'antd';
import { useCallback } from 'react';

const { Text } = Typography;

export default ({ open, node, onChange, onCancel, onConfirm }) => {
  const onChangeName = useCallback((e) => {
    onChange({
      name: e.target.value,
    });
  }, []);
  const onChangeIp = useCallback((e) => {
    onChange({
      ip: e.target.value,
    });
  }, []);
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      title="Modal Form on SharedMemory"
      style={{
        left: '40%',
        margin: '0',
      }}
    >
      <Text>Check out the card text behind the modal when editing.</Text>
      <Input value={node.name} onChange={onChangeName} />
      <Input value={node.ip} onChange={onChangeIp} />
    </Modal>
  );
};
