import numpy as np

X = [ [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6], 
      [1, 2, 3, 4, 5, 6] ]

def sigmoid(x):
    return 1 / (1 + np.exp(-x)) # normalization function for final result

def relu(x):
    return np.maximum(0, x) # Layer activation function (for hidden layers)

class Layer_Dense:
    def __init__(self, n_inputs, n_neurons):
        self.weights = 0.1 * np.random.randn(n_inputs, n_neurons) # initializing hidden layers (12 neurons layer 1, 8 layer2)
        self.biases = np.zeros((1, n_neurons))                      # OBS: the shape of weights is (n_inputs, n_neurons1), which is already transposed
    def forward(self, inputs):
        self.output = relu(np.dot(inputs, self.weights) + self.biases)
    def forward_f(self, inputs):
        self.output = sigmoid(np.dot(inputs, self.weights) + self.biases) #just applied in the final result


layer1 = Layer_Dense(6, 12)
layer2 = Layer_Dense(12, 8)
result = Layer_Dense(8, 1)

layer1.forward(X)
layer2.forward(layer1.output)
result.forward_f(layer2.output)

print(layer1.output)
print(layer2.output)
print(result.output)