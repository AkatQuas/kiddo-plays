import {
  Cross1Icon,
  FileIcon,
  FilePlusIcon,
  PaperPlaneIcon
} from '@radix-ui/react-icons';
import { useState } from 'react';
import { useChatInput } from '../../hooks/use_chat_input';
import { Button } from '../common/button';
import { Input } from '../common/input';

interface ChatInputProps {
  sessionId: string | null;
}

export const ChatInput = ({ sessionId }: ChatInputProps) => {
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    handleKeyDown,
    handleFileUpload,
    abortRequest,
    errors,
    isStreaming
  } = useChatInput(sessionId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      handleFileUpload(e.target.files);
    }
  };

  const removeFile = () => {
    setFile(null);
    // Clear file input
    (document.getElementById('file-upload') as HTMLInputElement).value = '';
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-2 p-4 border-t"
    >
      {/* File upload preview */}
      {file && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate">{file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={removeFile}
          >
            <Cross1Icon className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input field */}
      <div className="flex gap-2">
        <Input
          id="message-input"
          type="text"
          placeholder="Type your message..."
          disabled={isStreaming || !sessionId}
          {...register('message')}
          error={errors.message?.message}
          className="flex-1"
        />

        {/* File upload button */}
        <label htmlFor="file-upload">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={isStreaming || !sessionId}
            className="cursor-pointer"
            asChild
          >
            <FilePlusIcon className="h-4 w-4" />
          </Button>
        </label>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isStreaming || !sessionId}
        />

        {/* Send/Abort button */}
        {isStreaming ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={abortRequest}
          >
            <Cross1Icon className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="default"
            size="icon"
            disabled={!sessionId}
          >
            <PaperPlaneIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
};
