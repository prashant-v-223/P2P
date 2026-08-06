import React, { forwardRef } from 'react';
import { CustomInput } from './custom-input';

const Input = forwardRef((props, ref) => {
  return <CustomInput ref={ref} {...props} />;
});

Input.displayName = 'Input';

export { Input, CustomInput };
