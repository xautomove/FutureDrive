import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import './CodeEditor.css';

const CodeEditor = ({ value, language = 'javascript', onChange, readOnly = false }) => {
  const handleChange = (value) => {
    onChange && onChange(value);
  };

  return (
    <div className="code-editor">
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={[javascript()]}
        onChange={handleChange}
        editable={!readOnly}
        style={{ height: '100%', overflow: 'auto' }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true
        }}
      />
    </div>
  );
};

export default CodeEditor; 