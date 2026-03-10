import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-x))


inputs = [1, 2, 3, 4, 5, 6]

weights1 = [[0.2, 2.8, 9.9, -1.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0],
            [2.2, 1.1, 0.2, -0.1, 9.9, -1.0],
            [0.2, 2.8, 9.9, -1.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0],
            [0.2, 2.8, 9.9, -1.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0],
            [0.2, 2.8, 9.9, -1.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0],
            [0.2, 2.8, 9.9, -1.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0],
            [6.7, 7.6, 3.9, -9.0, 9.9, -1.0]  ]

biases1 = [0.1, 0.2, 3.0, 
           0.1, 0.2, 3.0, 
           0.1, 0.2, 3.0, 
           0.1, 0.2, 3.0 ]


layer_out1 = []
for neu_weights, neu_bias in zip(weights1, biases1):
    neu_output = 0
    for p_input, weight in zip(inputs, neu_weights):
        neu_output += p_input*weight
    neu_output += neu_bias
    layer_out1.append(neu_output)
    
    
print(' '. join(str(round(i, 2)) for i in layer_out1))

weights2 = [ [0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [6.7, 7.6, 3.9, -9.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [2.2, 1.1, 0.2, -0.1, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [6.7, 7.6, 3.9, -9.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [6.7, 7.6, 3.9, -9.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0],
             [0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, -1.0] ]

biases2 = [ 0.1, 0.2, 3.0, 0.1, 0.2, 3.0, 0.1, 0.2]

layer_out2 = []
for neu_weights, neu_bias in zip(weights2, biases2):
    neu_output = 0
    for p_input, weight in zip(layer_out1, neu_weights):
        neu_output += p_input*weight
    neu_output += neu_bias
    layer_out2.append(neu_output)
    
print(' '. join(str(round(i, 2)) for i in layer_out2))

weights3 = [ [0.2, 2.8, 9.9, -1.0, 0.2, 2.8, 9.9, 0.6] ]

bias3 = 20

result = 0
for neu_weights in weights3:
    for p_input, weight in zip(layer_out2, neu_weights):
        result += p_input*weight
    result += bias3

print(result)

normalizado = sigmoid(result)
print(normalizado)